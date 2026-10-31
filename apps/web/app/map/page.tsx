import { SiteHeader } from "../../components/SiteHeader";
import { FindYourWay } from "./find-your-way";

export const metadata = { title: "Find your way · Throughline" };

export default function MapPage() {
  return (
    <>
      <SiteHeader current="/map" />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="font-display text-[40px] font-bold">Find your way</h1>
        <p className="mt-1 max-w-[65ch] text-[17px] text-ink-soft">
          Three buildings, three levels, two elevators. Routes avoid stairs unless you say
          otherwise, and every step names something you can see.
        </p>
        <div className="mt-6">
          <FindYourWay />
        </div>
      </main>
    </>
  );
}
