export default function InterceptedPlaceDetailLoading() {
  return (
    <div className="fixed inset-0 z-[100] bg-[#10251f]/55 backdrop-blur-sm">
      <section
        aria-busy="true"
        aria-label="Đang tải chi tiết địa điểm"
        className="absolute inset-0 animate-pulse bg-[#f3efe5] p-6 md:right-0 md:left-auto md:w-[min(760px,82vw)]"
      >
        <div className="h-12 w-40 rounded-xl bg-[#d9ddc7]" />
        <div className="mt-6 h-72 rounded-[2rem] bg-[#d9ddc7]" />
        <div className="mt-5 h-96 rounded-[2rem] bg-[#d9ddc7]" />
      </section>
    </div>
  );
}
