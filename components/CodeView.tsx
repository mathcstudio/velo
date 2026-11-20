"use client";

export default function CodeView({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <div className="h-full overflow-auto bg-[#1e1b2e] font-mono text-[13px] leading-6 text-violet-50">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="w-12 select-none pr-3 text-right align-top text-violet-300/40">{i + 1}</td>
              <td className="whitespace-pre-wrap break-all pr-4">{l || " "}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
