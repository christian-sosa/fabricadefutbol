import { Input } from "@/components/ui/input";

type MatchDateTimeFieldsProps = {
  dateId?: string;
  dateLabel?: string;
  dateName: string;
  defaultDate?: string;
  defaultTime?: string;
  disabled?: boolean;
  requiredTime?: boolean;
  timeId?: string;
  timeLabel?: string;
  timeName: string;
};

export function MatchDateTimeFields({
  dateId,
  dateLabel = "Fecha",
  dateName,
  defaultDate,
  defaultTime,
  disabled = false,
  requiredTime = false,
  timeId,
  timeLabel = "Hora",
  timeName
}: MatchDateTimeFieldsProps) {
  return (
    <>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={dateId ?? dateName}>
          {dateLabel}
        </label>
        <Input
          defaultValue={defaultDate}
          disabled={disabled}
          id={dateId ?? dateName}
          name={dateName}
          type="date"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={timeId ?? timeName}>
          {timeLabel}
        </label>
        <Input
          defaultValue={defaultTime}
          disabled={disabled}
          id={timeId ?? timeName}
          name={timeName}
          required={requiredTime}
          type="time"
        />
      </div>
    </>
  );
}
