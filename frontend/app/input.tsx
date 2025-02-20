export const NumericInput = ({ 
  value, 
  onChange, 
  min = 1, 
  max = 10, 
  label 
}: { 
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  label: string;
}) => {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        className="w-24 p-2 border rounded"
        value={value}
        onChange={e => {
          const val = e.target.value === '' ? min : parseInt(e.target.value);
          onChange(Math.max(min, Math.min(max, val)));
        }}
      />
    </div>
  );
};
