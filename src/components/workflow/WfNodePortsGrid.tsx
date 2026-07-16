import { Handle, Position } from '@xyflow/react';
import type { WfPortDef } from '../../services/workflowAiGenPorts';

export function WfPort({
  side,
  label,
  color,
  handleId,
  hideLabel,
}: {
  side: 'in' | 'out';
  label: string;
  color?: string;
  handleId?: string;
  hideLabel?: boolean;
}) {
  return (
    <div className={`wf-port wf-port--${side}${hideLabel ? ' wf-port--label-hidden' : ''}`}>
      <Handle
        type={side === 'in' ? 'target' : 'source'}
        position={side === 'in' ? Position.Left : Position.Right}
        id={handleId}
        className="wf-handle"
        style={color ? { background: color, borderColor: color } : undefined}
      />
      <span className="wf-port-label">{label}</span>
    </div>
  );
}

export function WfNodePortsGrid({
  ports,
  expanded,
}: {
  ports: { in: readonly WfPortDef[]; out: readonly WfPortDef[] };
  expanded: boolean;
}) {
  if (expanded) {
    return (
      <div className="wf-node-media-ports-grid">
        <div className="wf-node-ports-col-in">
          {ports.in.map((p) => (
            <WfPort key={p.id} side="in" label={p.label} color={p.color} handleId={p.id} />
          ))}
        </div>
        <div className="wf-node-ports-col-out">
          {ports.out.map((p) => (
            <WfPort key={p.id} side="out" label={p.label} color={p.color} handleId={p.id} />
          ))}
        </div>
      </div>
    );
  }

  /* Handles giữ layout ẩn để edge vẫn nối đúng vị trí */
  return (
    <div className="wf-node-handles-anchor" aria-hidden>
      <div className="wf-node-handles-anchor-grid">
        <div className="wf-node-ports-col-in">
          {ports.in.map((p) => (
            <WfPort
              key={p.id}
              side="in"
              label={p.label}
              color={p.color}
              handleId={p.id}
              hideLabel
            />
          ))}
        </div>
        <div className="wf-node-ports-col-out">
          {ports.out.map((p) => (
            <WfPort
              key={p.id}
              side="out"
              label={p.label}
              color={p.color}
              handleId={p.id}
              hideLabel
            />
          ))}
        </div>
      </div>
    </div>
  );
}
