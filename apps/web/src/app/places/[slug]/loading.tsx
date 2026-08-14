export default function PlaceDetailLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Đang tải chi tiết địa điểm"
      className="min-h-screen animate-pulse bg-[#f3efe5] px-4 py-8 text-[#18352d] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="h-12 w-40 rounded-xl bg-[#d9ddc7]" />
        <div className="mt-6 h-72 rounded-[2rem] bg-[#d9ddc7]" />
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="h-96 rounded-[2rem] bg-[#d9ddc7]" />
          <div className="h-64 rounded-[2rem] bg-[#d9ddc7]" />
        </div>
        <p className="sr-only">Đang đọc địa điểm từ PostgreSQL…</p>
      </div>
    </main>
  );
}
