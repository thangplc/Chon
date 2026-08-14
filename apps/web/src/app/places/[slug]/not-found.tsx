import Link from "next/link";

export default function PlaceDetailNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3efe5] px-6 text-center text-[#18352d]">
      <div className="max-w-lg rounded-[2rem] border border-[#173f33]/10 bg-white/80 p-8 shadow-xl">
        <p className="text-xs font-bold tracking-[0.15em] text-[#805b39] uppercase">
          404 · Chốn
        </p>
        <h1 className="mt-3 text-3xl font-bold">Không tìm thấy địa điểm</h1>
        <p className="mt-3 text-sm leading-6 text-[#5e746a]">
          Địa điểm không tồn tại, chưa được xuất bản hoặc không khả dụng trong
          môi trường hiện tại.
        </p>
        <Link
          className="mt-6 inline-flex rounded-xl bg-[#173f33] px-5 py-3 text-sm font-bold text-white"
          href="/"
        >
          Trở về Explore
        </Link>
      </div>
    </main>
  );
}
