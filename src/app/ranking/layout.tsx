import { ReactQueryProvider } from "@/components/providers/react-query-provider";

export default function RankingLayout({ children }: { children: React.ReactNode }) {
  return <ReactQueryProvider>{children}</ReactQueryProvider>;
}
