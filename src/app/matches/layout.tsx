import { ReactQueryProvider } from "@/components/providers/react-query-provider";

export default function MatchesLayout({ children }: { children: React.ReactNode }) {
  return <ReactQueryProvider>{children}</ReactQueryProvider>;
}
