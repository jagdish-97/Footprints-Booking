import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

function normalizeRows(rows) {
  return rows.reduce((acc, row) => {
    const key = row.date;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(row.time);
    return acc;
  }, {});
}

export async function GET(request) {
  const url = new URL(request.url);
  const therapistId = url.searchParams.get("therapistId");

  if (therapistId) {
    const { data, error } = await supabase
      .from("bookings")
      .select("date, time")
      .eq("therapist_id", therapistId)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error) {
      console.error("Error fetching bookings:", error);
      return NextResponse.json(
        { error: "Failed to fetch bookings", details: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json(normalizeRows(data));
  }

  const { data, error } = await supabase
    .from("bookings")
    .select("therapist_id, date, time")
    .order("therapist_id", { ascending: true })
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) {
    console.error("Error fetching all bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings", details: error.message, code: error.code },
      { status: 500 }
    );
  }

  const bookings = data.reduce((acc, row) => {
    const therapistBookings = acc[row.therapist_id] || {};
    const key = row.date;

    if (!therapistBookings[key]) {
      therapistBookings[key] = [];
    }

    therapistBookings[key].push(row.time);
    acc[row.therapist_id] = therapistBookings;
    return acc;
  }, {});

  return NextResponse.json(bookings);
}

export async function POST(request) {
  const body = await request.json();
  const { therapistId, dateKey, time, name, email, phone, contactMethod } = body;

  if (!therapistId || !dateKey || !time || !name || !email || !phone || !contactMethod) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert([
      {
        therapist_id: therapistId,
        date: dateKey,
        time,
        name,
        email,
        phone,
        contact_method: contactMethod,
      },
    ])
    .select();

  if (error) {
    console.error("Error inserting booking:", error);
    return NextResponse.json(
      { error: "Failed to save booking", details: error.message, code: error.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}