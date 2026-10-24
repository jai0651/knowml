import type { Metadata } from "next";
import { TopNav } from "@/components/top-nav";
import { pageMeta } from "@/lib/site";
import { MapScripts } from "./map-client";
import "./map.css";

export const metadata: Metadata = pageMeta(
  "/map",
  "Site map",
  "Every page on KnowML as one navigable graph: chapters grouped by theme, with the labs attached to the topics they belong to.",
);

export default function MapPage() {
  return (
    <>
      <TopNav />
      <div className="pg-map">
        <main className="mx-auto max-w-[1480px] px-4 pb-24 pt-8 sm:px-6">
          <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-accent">Overview</div>
          <h1 className="mb-3 text-[34px] font-bold tracking-tight text-ink sm:text-[40px]">The whole site, as a map</h1>
          <p className="mb-6 max-w-2xl text-[15.5px] leading-relaxed text-muted">
            Every chapter in its group, and the labs attached to the topics they belong to. Drag to pan,
            scroll to zoom, click any node to open it.
          </p>
          <div className="mm-bar">
            <input id="mapSearch" className="mm-search" type="text" placeholder="Filter the map: attention, quantization, LoRA…" autoComplete="off" />
            <div className="mm-zoom">
              <button id="mapOut" type="button" title="Zoom out">−</button>
              <button id="mapFit" type="button" title="Fit to screen">Fit</button>
              <button id="mapIn" type="button" title="Zoom in">+</button>
            </div>
            <span className="mm-legend">
              <span className="mm-key mm-key--group" />group
              <span className="mm-key mm-key--topic" />chapter
              <span className="mm-key mm-key--lab" />lab
            </span>
          </div>
          <div className="mm-stage">
            <div id="map" />
            <div id="mapTip" className="mm-tip" />
          </div>
        </main>
      </div>
      <MapScripts />
    </>
  );
}
