import ShortlistView from "./shortlist-view";

// Static-export requires generateStaticParams for dynamic routes.
// The 4 open positions are known and stable — enumerating here is honest.
export function generateStaticParams() {
  return [
    { jobId: "JOB001" },
    { jobId: "JOB002" },
    { jobId: "JOB003" },
    { jobId: "JOB004" },
  ];
}

export default async function JobShortlistPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <ShortlistView jobId={jobId} />;
}
