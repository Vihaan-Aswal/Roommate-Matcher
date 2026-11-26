interface StationMarkProps {
  station: string;
  label: string;
  note: string;
}

export function StationMark({ station, label, note }: StationMarkProps): JSX.Element {
  return (
    <p className="mm-station-mark">
      <span className="mm-station-mark-node" aria-hidden="true" />
      <span className="mm-station-mark-num">{station}</span>
      <span className="mm-station-mark-label">{label}</span>
      <span className="mm-station-mark-note">{note}</span>
    </p>
  );
}
