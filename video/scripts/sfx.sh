#!/usr/bin/env bash
# One-shot sounds and two ambient beds, all synthesized with ffmpeg (no stock audio).
set -e
O=public/audio/sfx
A="-y -loglevel error"
OUT="-ar 48000 -ac 2"
# handoff ticks (two pitches so a chain sounds like a phrase)
ffmpeg $A -f lavfi -i "aevalsrc='0.45*sin(2*PI*1318*t)*exp(-30*t)+0.12*sin(2*PI*2636*t)*exp(-50*t)':d=0.35" $OUT $O/tick-a.wav
ffmpeg $A -f lavfi -i "aevalsrc='0.45*sin(2*PI*1568*t)*exp(-30*t)+0.12*sin(2*PI*3136*t)*exp(-50*t)':d=0.35" $OUT $O/tick-b.wav
# gate: a low hold, then a two-note approval chime
ffmpeg $A -f lavfi -i "aevalsrc='0.5*sin(2*PI*196*t)*exp(-5*t)+0.2*sin(2*PI*392*t)*exp(-7*t)':d=0.8" $OUT $O/gate-hold.wav
ffmpeg $A -f lavfi -i "aevalsrc='0.4*sin(2*PI*784*t)*exp(-9*t)*lt(t,0.09)+0.4*sin(2*PI*1175*(t-0.09))*exp(-6*(t-0.09))*gte(t,0.09)':d=0.9" $OUT $O/gate-ok.wav
# whoosh for thread wipes
ffmpeg $A -f lavfi -i "anoisesrc=c=pink:a=0.5:d=0.7" -af "bandpass=f=1100:w=900,afade=t=in:d=0.25,afade=t=out:st=0.3:d=0.4,volume=0.6" $OUT $O/whoosh.wav
# soft count tick and SAM ping
ffmpeg $A -f lavfi -i "aevalsrc='0.3*sin(2*PI*2400*t)*exp(-120*t)':d=0.06" $OUT $O/count.wav
ffmpeg $A -f lavfi -i "aevalsrc='0.22*sin(2*PI*2093*t)*exp(-40*t)':d=0.25" $OUT $O/ping.wav
# camera shutter
ffmpeg $A -f lavfi -i "anoisesrc=c=white:a=0.6:d=0.12" -af "volume='if(lt(t,0.04),1,if(lt(t,0.06),0,if(lt(t,0.09),0.7,0)))':eval=frame,highpass=f=1500" $OUT $O/shutter.wav
# fax handshake: CNG beeps, answer tone, then modem hiss
ffmpeg $A -f lavfi -i "aevalsrc='0.25*sin(2*PI*1100*t)*lt(mod(t,0.9),0.5)*lt(t,1.0)+0.22*sin(2*PI*2100*t)*gte(t,1.1)*lt(t,1.9)':d=2.6" -f lavfi -i "anoisesrc=c=white:a=0.12:d=2.6" -filter_complex "[1]bandpass=f=1800:w=1400,volume='gte(t,1.9)':eval=frame[n];[0][n]amix=inputs=2:normalize=0,afade=t=out:st=2.2:d=0.4" $OUT $O/fax.wav
# a deep impact for the title and the big number
ffmpeg $A -f lavfi -i "aevalsrc='0.7*sin(2*PI*(55+30*exp(-8*t))*t)*exp(-2.2*t)':d=2.2" -af "lowpass=f=400" $OUT $O/impact.wav
# bell for the end
ffmpeg $A -f lavfi -i "aevalsrc='0.3*sin(2*PI*587.33*t)*exp(-1.4*t)+0.12*sin(2*PI*1174.66*t)*exp(-2*t)':d=4" $OUT $O/bell.wav

# Beds: D minor (the gaps), then D major (the thread), slow and airy.
bed() { # name dur freqs... ; layered sines with slow tremolo, soft noise, reverb-ish echo
  local name=$1 d=$2; shift 2
  local ins="" mix="" i=0
  for f in "$@"; do ins="$ins -f lavfi -i sine=f=$f:d=$d"; mix="$mix[$i]"; i=$((i+1)); done
  ffmpeg $A $ins -f lavfi -i "anoisesrc=c=pink:a=0.02:d=$d" -filter_complex \
    "${mix}amix=inputs=$i:normalize=0,volume=0.11,tremolo=f=0.12:d=0.35,lowpass=f=1400,aecho=0.8:0.7:180|420:0.35|0.22[p];[$i]lowpass=f=600[n];[p][n]amix=inputs=2:weights=1 0.5:normalize=0,afade=t=in:d=4,afade=t=out:st=$((d-4)):d=4" $OUT public/audio/$name.wav
}
bed bed-a 80 73.42 110 146.83 174.61 220
bed bed-b 200 73.42 110 146.83 185 220 293.66 329.63
echo ok
