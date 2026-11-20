import { board, money } from "../game/board";
import { buildPrice, levelName, members, quotedRent } from "../game/economy";
import type { View } from "../game/view";

export function Yield({ id, v }: { id: number; v: View | null }) {
  const group = board[id].group;
  if (group < 0) return null;
  const asset = v?.assets[id],
    value = asset?.value ?? board[id].base;
  const owner = asset?.owner ?? v?.players[v.turn].id;
  const family = members(id),
    count =
      1 +
      family.filter(
        (tile) =>
          tile.id !== id &&
          owner &&
          v?.assets[tile.id].owner === owner &&
          !v.assets[tile.id].loan,
      ).length;
  const rent = (level: number, owned = count) =>
    money(
      quotedRent(
        group,
        value,
        owned,
        owned === family.length,
        level,
        1,
        v?.settings.rent ?? 10000,
      ),
    );
  return (
    <section className="yield">
      <dl className="facts">
        <div>
          <dt>{asset?.owner ? "Aktuelle Miete" : "Miete nach Kauf"}</dt>
          <dd>
            {asset?.loan ? money(0) : rent(asset?.levels.length ?? 0)}
            {group === 9 && " / Würfelpunkt"}
          </dd>
        </div>
        {group === 9 &&
        v?.phase === "buy" &&
        v.players[v.turn].pos === id &&
        v.movement?.distance ? (
          <div>
            <dt>Bei diesem Wurf ({v.movement.distance})</dt>
            <dd>
              {money(
                quotedRent(
                  group,
                  value,
                  count,
                  false,
                  0,
                  v.movement.distance,
                  v.settings.rent,
                ),
              )}
            </dd>
          </div>
        ) : null}
        {group < 8 ? (
          <div>
            <dt>Geldstapel / Hotelstufe</dt>
            <dd>{money(buildPrice(value))} je Stufe</dd>
          </div>
        ) : (
          <div>
            <dt>Ausbau</dt>
            <dd>Nicht ausbaubar</dd>
          </div>
        )}
      </dl>
      <details>
        <summary>Mietstaffel</summary>
        <dl className="facts">
          {(group < 8
            ? [0, 1, 2, 3, 4, 5]
            : group === 8
              ? [1, 2, 3, 4]
              : [1, 2]
          ).map((n) => (
            <div key={n}>
              <dt>
                {group < 8
                  ? n ? levelName(n) : "Ohne Ausbau"
                  : `${n} ${group === 8 ? (n === 1 ? "Flughafen" : "Flughäfen") : "VC"}`}
              </dt>
              <dd>
                {group < 8 ? rent(n) : rent(0, n)}
                {group === 9 && " / Punkt"}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
