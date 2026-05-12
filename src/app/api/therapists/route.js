import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function normalizeTherapist(row) {
  return {
    id: row.id,
    email: row.email ?? "",
    name: row.name ?? "",
    image: normalizeImagePath(row.image),
    title: row.title ?? "",
    location: row.location ?? "",
    specialties: Array.isArray(row.specialties) ? row.specialties : [],
    languages: Array.isArray(row.languages) ? row.languages : [],
    therapyTypes: Array.isArray(row.therapy_types) ? row.therapy_types : [],
    price: row.price,
    availability: row.availability ?? "Available",
    summary: row.summary ?? "",
    isActive: row.is_active ?? true,
  };
}

function normalizeImagePath(value) {
  if (!value) {
    return "/data/portraits/portrait.svg";
  }

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }

  return `/${value}`;
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const therapistId = url.searchParams.get("therapistId");

    let query = supabase
      .from("therapists")
      .select(
        "id, email, name, image, title, location, specialties, languages, therapy_types, price, availability, summary, is_active"
      )
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (therapistId) {
      query = query.eq("id", therapistId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("THERAPISTS GET ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalized = (data ?? []).map(normalizeTherapist);

    if (therapistId) {
      return NextResponse.json(normalized[0] ?? null);
    }

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("UNEXPECTED THERAPISTS GET ERROR:", error);
    return NextResponse.json(
      { error: "Unexpected server error", details: error.message },
      { status: 500 }
    );
  }
}
