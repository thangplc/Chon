"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CollectionSummary } from "@chon/contracts/collections";

import {
  createCollection,
  deleteCollection,
  loadCollections,
  updateCollection,
} from "../data/collections-repository";
import { SavedPlaceError } from "../data/saved-places-repository";

export function SavedPlacesView() {
  const [collections, setCollections] = useState<readonly CollectionSummary[]>(
    [],
  );
  const [state, setState] = useState<
    "loading" | "ready" | "signed-out" | "error"
  >("loading");
  const [showForm, setShowForm] = useState(false);
  const refresh = () =>
    loadCollections().then((data) => {
      setCollections(data);
      setState("ready");
    });

  useEffect(() => {
    void refresh().catch((error) =>
      setState(
        error instanceof SavedPlaceError && error.status === 401
          ? "signed-out"
          : "error",
      ),
    );
  }, []);
  if (state === "loading")
    return <p className="text-[#756c63]">Đang tải bộ sưu tập…</p>;
  if (state === "signed-out")
    return <p className="text-[#756c63]">Hãy đăng nhập để xem bộ sưu tập.</p>;
  if (state === "error")
    return (
      <p className="text-[#8c5a18]">
        Không thể tải danh sách. Hãy thử lại sau.
      </p>
    );

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <button
          className="rounded-xl bg-[#c96040] px-4 py-3 font-bold text-white"
          onClick={() => setShowForm(true)}
          type="button"
        >
          + Tạo bộ sưu tập
        </button>
      </div>
      {showForm && (
        <CollectionForm
          onCancel={() => setShowForm(false)}
          onSave={async (input) => {
            await createCollection(input);
            setShowForm(false);
            await refresh();
          }}
        />
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {collections.map((collection) => (
          <li
            className="rounded-2xl border border-[#ddd2c3] bg-[#fffdf9] p-5"
            key={collection.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-wide text-[#756c63] uppercase">
                  {collection.visibility === "public"
                    ? "🌐 Công khai"
                    : "🔒 Riêng tư"}
                </p>
                <Link
                  className="mt-1 block text-xl font-extrabold hover:text-[#963f2a]"
                  href={`/saved/${collection.slug}`}
                >
                  {collection.name}
                </Link>
              </div>
              <span className="rounded-full bg-[#f1e9dc] px-3 py-1 text-sm font-bold">
                {collection.placeCount}
              </span>
            </div>
            {collection.description && (
              <p className="mt-3 text-sm leading-6 text-[#5e746a]">
                {collection.description}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              {collection.visibility === "public" && (
                <Link
                  className="text-sm font-bold text-[#315d50]"
                  href={`/collections/${collection.id}`}
                >
                  Link chia sẻ ↗
                </Link>
              )}
              {!collection.isDefault && (
                <CollectionActions
                  collection={collection}
                  onChanged={refresh}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CollectionActions({
  collection,
  onChanged,
}: Readonly<{
  collection: CollectionSummary;
  onChanged: () => Promise<void>;
}>) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <CollectionForm
        initial={collection}
        onCancel={() => setEditing(false)}
        onSave={async (input) => {
          await updateCollection(collection.slug, input);
          setEditing(false);
          await onChanged();
        }}
      />
    );
  return (
    <>
      <button
        className="text-sm font-bold"
        onClick={() => setEditing(true)}
        type="button"
      >
        Chỉnh sửa
      </button>
      <button
        className="text-sm font-bold text-[#963f2a]"
        onClick={async () => {
          if (window.confirm(`Xóa “${collection.name}”?`)) {
            await deleteCollection(collection.slug);
            await onChanged();
          }
        }}
        type="button"
      >
        Xóa
      </button>
    </>
  );
}

function CollectionForm({
  initial,
  onCancel,
  onSave,
}: Readonly<{
  initial?: CollectionSummary;
  onCancel: () => void;
  onSave: (input: {
    name: string;
    description: string | null;
    visibility: "private" | "public";
  }) => Promise<void>;
}>) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [visibility, setVisibility] = useState<"private" | "public">(
    initial?.visibility ?? "private",
  );
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="mb-6 min-w-72 rounded-2xl border border-[#d7c5b1] bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        void onSave({
          name,
          description: description.trim() || null,
          visibility,
        }).finally(() => setSaving(false));
      }}
    >
      <label className="block font-bold">
        Tên bộ sưu tập
        <input
          className="mt-2 w-full rounded-xl border p-3 font-normal"
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </label>
      <label className="mt-4 block font-bold">
        Mô tả
        <textarea
          className="mt-2 w-full rounded-xl border p-3 font-normal"
          maxLength={500}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          value={description}
        />
      </label>
      <label className="mt-4 block font-bold">
        Quyền xem
        <select
          className="ml-3 rounded-lg border p-2 font-normal"
          onChange={(event) =>
            setVisibility(event.target.value as "private" | "public")
          }
          value={visibility}
        >
          <option value="private">Riêng tư</option>
          <option value="public">Công khai</option>
        </select>
      </label>
      <div className="mt-5 flex gap-2">
        <button
          className="rounded-lg bg-[#c96040] px-4 py-2 font-bold text-white disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          {saving ? "Đang lưu…" : "Lưu"}
        </button>
        <button
          className="rounded-lg border px-4 py-2"
          onClick={onCancel}
          type="button"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
