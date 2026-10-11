import { ASSUMPTIONS } from '../../shared/hotspots';
import { Modal } from './common';

export function SourcesPanel({ onClose }: { onClose: () => void }) {
  return (
    <Modal labelledBy="sources-title" onClose={onClose} wide>
      <h2 id="sources-title" className="text-[13px]">Sources and assumptions</h2>
      <p className="m-0 text-muted">
        Every number in EcoMap is a rounded, real-world approximation chosen to show scale. They are not measurements of a specific building.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[18px]">
          <thead>
            <tr className="label-caps">
              <th className="border-b-2 border-line py-2 pr-3 font-normal">Topic</th>
              <th className="border-b-2 border-line py-2 pr-3 font-normal">Value used</th>
              <th className="border-b-2 border-line py-2 font-normal">Basis</th>
            </tr>
          </thead>
          <tbody>
            {ASSUMPTIONS.map((a) => (
              <tr key={a.topic} className="align-top">
                <td className="border-b border-line py-2 pr-3">{a.topic}</td>
                <td className="border-b border-line py-2 pr-3 text-gold">{a.value}</td>
                <td className="border-b border-line py-2 text-muted">{a.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end"><button type="button" className="btn" onClick={onClose}>Close</button></div>
    </Modal>
  );
}
