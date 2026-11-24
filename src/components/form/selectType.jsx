import { Building2, User } from "lucide-react";

const roles = [
  ["individual", User, "Individual", "View and manage health records"],
  ["organization", Building2, "Organization", "Issue health records to patients"],
];

export default function SelectType({ onSelect }) {
  return (
    <div className="grid gap-2">
      <h3 className="text-base font-semibold">Choose your role</h3>
      {roles.map(([value, Icon, label, description]) => (
        <button key={value} type="button" className="record-role" onClick={() => onSelect(value)}>
          <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
          <span><strong>{label}</strong><small>{description}</small></span>
        </button>
      ))}
    </div>
  );
}
