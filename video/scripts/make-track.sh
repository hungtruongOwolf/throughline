#!/usr/bin/env bash
# Throughline launch track: 120 BPM, A minor, ffmpeg-only synthesis.
# 120 BPM at 30 fps => 1 beat = 0.5 s = 15 frames, 1 bar (4/4) = 2 s = 60 frames.
# Usage: bash make-track.sh [outdir]   (Git Bash on Windows, ffmpeg 7.1)
# Section starts are in BARS (bar n starts at n*2 seconds = n*60 frames).
set -euo pipefail
OUT="${1:-.}"; mkdir -p "$OUT"; cd "$OUT"

DUR=186          # seconds (93 bars)
HAT_IN=8         # bar: quiet hats/ticks enter (tension)
D1=28            # bar: DROP 1 = product reveal (t = 32 s, frame 960)
BRK=61           # bar: breakdown, the human gate
D2=67            # bar: DROP 2 (t = 112 s)
OUT_BAR=86       # bar: outro
LOGO=90          # bar: final impact on the logo
SR=48000
q() { ffmpeg -hide_banner -loglevel error -y "$@"; }

# Shared expression fragments. st(0)=beat phase, st(1)=bar index.
BEAT="st(0,mod(t,0.5));st(1,floor(t/2))"
# gate: 1 while the four-on-the-floor sections are running
DRUMS="(between(ld(1),${D1},${BRK}-0.001)+between(ld(1),${D2},${OUT_BAR}+3.999))"
# kick ducking envelope (fake sidechain): 0.35 right on the kick, back to 1 within ~0.25 s
DUCK="(1-0.65*exp(-ld(0)*12)*${DRUMS})"
# chord root in semitones above A1 (55 Hz): Am F C G  (one chord per bar)
ROOT="(12*eq(mod(ld(1),4),0)+8*eq(mod(ld(1),4),1)+15*eq(mod(ld(1),4),2)+10*eq(mod(ld(1),4),3))"

# 1) KICK: sine with exponential pitch drop 206 Hz -> 45 Hz, plus a 2 ms click.
#    Intro: half-time "heartbeat" kick (beats 1 and 3) at low level from bar 4.
q -f lavfi -i "aevalsrc='${BEAT};
 st(2,0.95*sin(2*PI*(45*ld(0)+4.6*(1-exp(-ld(0)*35))))*exp(-ld(0)*8)+0.15*exp(-ld(0)*900));
 ld(2)*${DRUMS}
 + 0.45*ld(2)*between(ld(1),4,${D1}-0.001)*lt(mod(t,1),0.5)':s=${SR}:d=${DUR}" kick.wav

# 2) HATS: white noise from random(), offbeat 8ths (open-ish) + quiet 16ths; high-passed.
q -f lavfi -i "aevalsrc='${BEAT};
 st(3,2*random(4)-1);
 st(5,mod(t-0.25,0.5));
 st(6,mod(t,0.125));
 ld(3)*( 0.55*exp(-ld(5)*30)*(${DRUMS}+0.35*between(ld(1),${HAT_IN},${D1}-0.001))
       + 0.22*exp(-ld(6)*90)*(${DRUMS}*between(ld(1),${D1}+8,999)+0.15*between(ld(1),${HAT_IN},${D1}-0.001)) )':s=${SR}:d=${DUR}" \
  -af "highpass=f=7000,highpass=f=7000,volume=1.6" hats.wav

# 3) CLAP on beats 2 and 4: three fast noise bursts then a tail, band-passed. Second half of drop 1 + drop 2.
q -f lavfi -i "aevalsrc='${BEAT};
 st(7,mod(t-0.5,1));
 (2*random(8)-1)*(exp(-ld(7)*25)+0.6*exp(-abs(ld(7)-0.011)*400)+0.6*exp(-abs(ld(7)-0.022)*400))
 *(between(ld(1),${D1}+16,${BRK}-0.001)+between(ld(1),${D2},${OUT_BAR}-0.001))':s=${SR}:d=${DUR}" \
  -af "bandpass=f=1400:width_type=q:w=0.9,aecho=0.8:0.5:23:0.25,volume=2.2" clap.wav

# 4) BASS ARP: 16th-note saw arpeggio (root, +12, +7, +12) on Am-F-C-G, ducked by the kick.
#    Intro (bars 8..D1): root-only 8th-note pulse, quieter.  Breakdown: off.
q -f lavfi -i "aevalsrc='${BEAT};
 st(8,mod(floor(t*8),4));
 st(9,55*pow(2,(${ROOT}+12*eq(ld(8),1)+7*eq(ld(8),2)+12*eq(ld(8),3))/12));
 st(10,mod(t,0.125));
 st(11,55*pow(2,${ROOT}/12));
 st(12,mod(t,0.25));
 0.5*(2*mod(ld(9)*ld(10),1)-1)*min(1,ld(10)*400)*exp(-ld(10)*10)*${DUCK}
   *(between(ld(1),${D1},${BRK}-0.001)+between(ld(1),${D2},${OUT_BAR}+3.999))
 + 0.35*(2*mod(ld(11)*ld(12),1)-1)*min(1,ld(12)*400)*exp(-ld(12)*7)*between(ld(1),${HAT_IN},${D1}-0.001)':s=${SR}:d=${DUR}" \
  -af "lowpass=f=1100,lowpass=f=1800,volume=1.3" bass.wav

# 5) PAD: minor/major triad (two detuned sines per note) one octave up, de-clicked at bar edges, ducked.
q -f lavfi -i "aevalsrc='${BEAT};
 st(13,110*pow(2,${ROOT}/12));
 st(14,pow(2,(3*eq(mod(ld(1),4),0)+4*(1-eq(mod(ld(1),4),0)))/12));
 st(15,1.4983);
 st(16,mod(t,2));
 0.12*(sin(2*PI*ld(13)*t)+sin(2*PI*ld(13)*1.003*t)
      +sin(2*PI*ld(13)*ld(14)*t)+sin(2*PI*ld(13)*ld(14)*0.997*t)
      +sin(2*PI*ld(13)*ld(15)*t)+sin(2*PI*ld(13)*ld(15)*1.002*t))
 *min(1,ld(16)*3)*min(1,(2-ld(16))*20)*${DUCK}
 *(0.5+0.5*between(ld(1),${BRK},${D2}-0.001))*lt(ld(1),${LOGO}+2)':s=${SR}:d=${DUR}" \
  -af "lowpass=f=2500,aecho=0.8:0.7:120|240:0.3|0.2" pad.wav

# 6) RISERS: 4 bars (8 s) before each drop. Noise swell + sine sweep 200->2000 Hz, cut 1 beat before the drop
#    (the "hole" before the hit), plus a 1-bar riser into the logo.
riser() { # $1 = start s, $2 = length s
  echo "if(between(t,$1,$1+$2-0.5),(pow((t-$1)/$2,2.2))*(0.5*(2*random(20)-1)+0.35*sin(2*PI*(200*(t-$1)+(1800/(2*$2))*(t-$1)*(t-$1)))),0)"
}
R1=$(riser $(( (D1-4)*2 )) 8); R2=$(riser $(( (D2-4)*2 )) 8); R3=$(riser $(( (LOGO-1)*2 )) 2)
q -f lavfi -i "aevalsrc='${R1}+${R2}+0.7*${R3}':s=${SR}:d=${DUR}" -af "highpass=f=300,volume=1.2" risers.wav

# 7) IMPACTS on drop 1, drop 2 and the logo: pitch-dropping sub boom + noise crack, with echo tail.
impact() { # $1 = time s
  echo "if(gte(t,$1),0.9*sin(2*PI*(38*(t-$1)+(120/6)*(1-exp(-(t-$1)*6))))*exp(-(t-$1)*2.2)+0.5*(2*random(30)-1)*exp(-(t-$1)*14),0)"
}
q -f lavfi -i "aevalsrc='$(impact $((D1*2)))+$(impact $((D2*2)))+$(impact $((LOGO*2)))':s=${SR}:d=${DUR}" \
  -af "aecho=0.8:0.6:60|130:0.35|0.2,lowpass=f=6000" impacts.wav

# 8) MIX: stereo widening on hats/pad via small delays, master fade, limiter, loudness for a music BED.
q -i kick.wav -i hats.wav -i clap.wav -i bass.wav -i pad.wav -i risers.wav -i impacts.wav -filter_complex "
 [1]aformat=channel_layouts=mono,asplit[h1][h2];[h2]adelay=9[h2d];[h1][h2d]join=inputs=2:channel_layout=stereo[hats];
 [4]aformat=channel_layouts=mono,asplit[p1][p2];[p2]adelay=17[p2d];[p1][p2d]join=inputs=2:channel_layout=stereo[pad];
 [0]pan=stereo|c0=c0|c1=c0[k];[2]pan=stereo|c0=c0|c1=c0[c];[3]pan=stereo|c0=c0|c1=c0[b];
 [5]pan=stereo|c0=c0|c1=c0[r];[6]pan=stereo|c0=c0|c1=c0[i];
 [k][hats][c][b][pad][r][i]amix=inputs=7:weights='1.0 0.5 0.45 0.7 0.6 0.55 0.9':normalize=0,
 afade=t=in:d=1.5,afade=t=out:st=$((DUR-6)):d=6,
 alimiter=limit=0.89:level=disabled[out]" \
 -map "[out]" -c:a pcm_f32le premaster.wav

# Two-pass LINEAR loudnorm. (Single-pass loudnorm is dynamic: it pumps the quiet intro up
# until it is as loud as the drop, which kills the build.)
M=$(ffmpeg -hide_banner -i premaster.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | tr -d ' \t\r')
v() { echo "$M" | grep -o "\"$1\":\"[^\"]*\"" | cut -d'"' -f4; }
q -i premaster.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11:linear=true:measured_I=$(v input_i):measured_TP=$(v input_tp):measured_LRA=$(v input_lra):measured_thresh=$(v input_thresh):offset=$(v target_offset),aresample=${SR}" \
  -c:a pcm_s16le music.wav
echo "done: $(pwd)/music.wav (stems: kick hats clap bass pad risers impacts)"
