import { useState } from "react";
import { type Tile, colours } from "../game/board";
import { fieldName, fieldPrice, fieldPrint, fieldAmount } from "./fieldPrint";
import { companyLogo, isSurveyPhoto, siteCaption, sitePhoto } from "./companyLogos";

export function FieldEmblem({ tile, owner }: { tile: Tile; owner?: number }) {
  const design = fieldPrint(tile, owner);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const source = [sitePhoto(tile.id, true), companyLogo(tile)].find(candidate => candidate && !unavailable.includes(candidate));
  return (
    <svg width="64" height="44" viewBox="0 0 64 44" aria-hidden="true">
      {source ? (
        <image href={source} width="64" height="44" preserveAspectRatio="xMidYMid meet" onError={() => setUnavailable(previous => [...previous, source])} />
      ) : <>
      <path d={design.cut} fill={design.ink} />
      <path d={design.second} fill={design.accent} />
      <path d={design.light} fill={design.paper} />
      </>}
    </svg>
  );
}

export function SiteFigure({tile}: {tile: Tile}) {
  const source = sitePhoto(tile.id), caption = siteCaption(tile.id), logo = companyLogo(tile);
  const [failed, setFailed] = useState<string>();
  if (!source || !caption || source === failed) return null;
  return (
    <figure className="site-figure">
      <img className="site-photo" src={source} alt={caption} onError={() => setFailed(source)} />
      <figcaption>
        {logo && <img className="site-brand" src={logo} alt="" />}
        <span>{caption}</span>
        <a href={`/orte/quellen.html#feld-${tile.id}`} target="_blank" rel="noreferrer">{isSurveyPhoto(tile.id) ? "© swisstopo" : "Bildnachweis"}</a>
      </figcaption>
    </figure>
  );
}

export function FieldTile({
  tile,
  owner,
  value,
  level,
  rent,
  classic = false,
}: {
  tile: Tile;
  owner?: number;
  value: number;
  level: number;
  rent?: number | null;
  classic?: boolean;
}) {
  const design = fieldPrint(tile, owner),
    corner = tile.id % 10 === 0,
    across = !corner && Math.floor(tile.id / 10) % 2 === 1;
  const width = corner || across ? 164 : 100,
    height = across ? 100 : 164;
  const name = fieldName(tile),
    amount = tile.base ? fieldPrice(tile, value) : "";
  const names =
    !across && !corner && name.includes(" ") ? name.split(" ") : [name];
  if (classic) {
    const side = Math.floor(tile.id / 10);
    const logo = companyLogo(tile);
    const paper = design.paper;
    const band = 35, depth = 136, size = corner ? depth : 100;
    const markX = across ? (side === 1 ? band : 0) : 0;
    const markY = !corner && side === 2 ? band : 0;
    const tag = tile.group >= 8 ? (tile.group === 8 ? "Flughafen" : "VC") : "";
    const card = tile.name === "Chance" || tile.name === "Ereignis";
    const tax = tile.group < 0 && tile.base > 0;
    const priceRegion = ["translate(0 101)", "translate(0 100) rotate(-90)", "", "translate(136 0) rotate(90)"][side];
    return (
      <svg className="field-face classic-face" viewBox={`0 0 ${across ? depth : size} ${across ? 100 : depth}`} preserveAspectRatio="none" aria-hidden="true" fontFamily="'Barlow Condensed', sans-serif" textAnchor="middle">
        <rect width="100%" height="100%" fill={paper} />
        {tile.group >= 0 && <g className="price-edge" transform={priceRegion}>
          <rect width="100" height={band} fill={colours[tile.group]}/>
          <rect y={side === 0 ? 0 : 6} width="100" height={band-6} fill="#152b26" fillOpacity=".88"/>
          <text x="50" y={side === 0 ? 22 : 28} fontSize="23" fontWeight="700" fill="#fff9e9">{amount}</text>
        </g>}
        <g transform={`translate(${tile.group >= 0 ? markX : (across ? 18 : 0)} ${tile.group >= 0 ? markY : (!across && !corner ? 18 : 0)})`}>
          <text x="6" y="14" textAnchor="start" fontSize="14" fontWeight="600" fill="#535c57">{String(tile.id).padStart(2,"0")}</text>
          {logo ? <image href={logo} x="8" y="19" width="84" height="66" preserveAspectRatio="xMidYMid meet"/> : card ? <g transform="rotate(-8 50 50)">
            <rect x="27" y="19" width="46" height="62" rx="3" fill={tile.name === "Chance" ? "#963e34" : "#243e45"}/>
            <rect x="31" y="23" width="38" height="54" rx="1" fill="none" stroke="#d7b87d" strokeWidth="1.7"/>
            <text x="50" y="62" fill="#f1d89f" fontFamily="Georgia,serif" fontSize="35" fontWeight="700">{tile.name === "Chance" ? "?" : "✦"}</text>
          </g> : tax ? <><text x="50" y="48" fontSize="30" fontWeight="700" fill={design.ink}>Steuer</text><text x="50" y="75" fontSize="24" fontWeight="700" fill="#87392e">{amount}</text></> : <>
            <g transform={corner ? "translate(29 15) scale(1.23)" : "translate(30 8) scale(.64)"}><path d={design.cut} fill={corner ? "#28564a" : "#46556c"}/><path d={design.second} fill={corner ? "#b36a32" : "#8098a2"}/><path d={design.light} fill={paper}/></g>
            {tag && <text x="50" y="57" fontSize="17" fill="#4a5566">{tag}</text>}
            <text x={size/2} y={corner ? 102 : 81} fontSize={corner ? 24 : 23} fontWeight="700" fill="#202739" textLength={name.length > 9 ? size-10 : undefined} lengthAdjust="spacingAndGlyphs">{name}</text>
          </>}
          {level > 0 && <g><rect x="71" y="1" width="28" height="21" fill="#263248"/><text x="85" y="17" fontSize="17" fill="white">{level === 4 ? "H" : level}</text></g>}
        </g>
      </svg>
    );
  }
  return (
    <svg
      className="field-face"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      fill={design.ink}
    >
      <rect width={width} height={height} fill={design.paper} />
      <rect
        x="1"
        y="1"
        width={width - 2}
        height={height - 2}
        fill="none"
        stroke={design.ink}
        strokeWidth="2"
      />
      <path d={`M2 2h${width - 4}v7H2Z`} fill={colours[tile.group] ?? design.ink} />
      <text x="9" y="29" fontSize="15" fontWeight="700">
        {String(tile.id).padStart(2, "0")}
      </text>
      <g
        transform={
          across
            ? "translate(46 14) scale(.93)"
            : corner
              ? "translate(30 20) scale(1.62)"
              : "translate(13 23) scale(1.16)"
        }
      >
        <FieldEmblem tile={tile} owner={owner} />
      </g>
      {names.map((part, index) => (
        <text
          key={index}
          x={width / 2}
          y={
            across
              ? 81
              : corner
                ? 124
                : names.length > 1
                  ? 91 + index * 21
                  : 103
          }
          textAnchor="middle"
          fontFamily="'Barlow Condensed', sans-serif"
          fontSize={across || corner ? 34 : 28}
          fontWeight="700"
          textLength={
            part.length > (across || corner ? 11 : 8) ? width - 14 : undefined
          }
          lengthAdjust="spacingAndGlyphs"
        >
          {part}
        </text>
      ))}
      {across ? (
        <text
          x={width - 9}
          y="29"
          textAnchor="end"
          fontSize="17"
          fontWeight="700"
        >
          {amount}
        </text>
      ) : (
        <>
          <path
            d={`M${width * 0.18} ${corner ? 139 : 123} h${width * 0.64}`}
            fill="none"
            stroke={design.accent}
            strokeWidth="2"
          />
          {!corner && (
            <text
              x={width / 2}
              y="145"
              textAnchor="middle"
              fontWeight="700"
              fontSize="18"
            >
              {amount || "KARTE"}
            </text>
          )}
        </>
      )}
      {rent != null && (
        <text
          className="tile-rent"
          x={across ? width - 9 : width / 2}
          y={across ? 47 : 160}
          textAnchor={across ? "end" : "middle"}
          fontSize="12"
          fontWeight="700"
          fill="#7a3324"
        >
          Miete {fieldAmount(rent)}
        </text>
      )}
    </svg>
  );
}
