import { formatCount, type Run } from "./simulate";

interface StationPathProps {
  run: Run;
}

export function StationPath({ run }: StationPathProps): JSX.Element {
  const roomCounts = run.rooms.reduce<Record<number, number>>(
    (counts, room) => {
      counts[room.members.length] = (counts[room.members.length] ?? 0) + 1;
      return counts;
    },
    {},
  );

  const stations = [
    {
      number: "01",
      name: "Inputs",
      note: `${run.students.length} students · ${run.rooms.length} rooms`,
      href: "#sample-run",
      inFilm: true,
    },
    {
      number: "02",
      name: "Form",
      note: "12 questions · once",
      href: "#sample-run",
      inFilm: true,
    },
    {
      number: "03",
      name: "Boundaries",
      note: `${formatCount(run.pairsRejected)} pairs cut`,
      href: "#boundary",
    },
    {
      number: "04",
      name: "Score",
      note: "10 weighted factors",
      href: "#compatibility",
    },
    {
      number: "05",
      name: "Match",
      note: `${roomCounts[2] ?? 0} + ${roomCounts[3] ?? 0} + ${roomCounts[4] ?? 0} rooms`,
      href: "#compatibility",
    },
    {
      number: "06",
      name: "Fairness",
      note: `${run.atRiskStudents.length} below the floor`,
      href: "#fairness",
    },
    {
      number: "07",
      name: "Documents",
      note: "4 working files",
      href: "#artifacts",
    },
    {
      number: "08",
      name: "Sign-off",
      note: "a person signs",
      href: "#sign-off",
    },
  ];

  return (
    <section className="mm-path" aria-labelledby="path-heading">
      <div className="mm-wrap">
        <div className="mm-path-head">
          <div>
            <p className="mm-eyebrow">After the film</p>
            <h2 id="path-heading">
              The film is the run.
              <br />
              The page is the file.
            </h2>
          </div>
          <p className="mm-path-lede">
            One sample cohort, followed from the first boundary to the signature. Every number
            below comes from the same run you just watched.
          </p>
        </div>

        <nav aria-label="The eight stations">
          <ol className="mm-path-list">
            {stations.map((station) => (
              <li key={`${station.number}-${station.name}`}>
                <a href={station.href} className={station.inFilm ? "is-film" : undefined}>
                  <span className="mm-path-num">{station.number}</span>
                  <span className="mm-path-name">{station.name}</span>
                  <span className="mm-path-note">{station.note}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <p className="mm-path-foot">
          01–02 play in the film above. 03–08 are argued on this page.
        </p>
      </div>
    </section>
  );
}
