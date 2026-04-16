import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
// 🔹 Helper: Convert rows into { date: [times] }
function normalizeRows(rows) {
  return rows.reduce((acc, row) => {
    const key = row.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row.time);
    return acc;
  }, {});
}

// ✅ GET BOOKINGS
export async function GET(request) {
  try {
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
        console.error("GET ERROR (single therapist):", error);
        return NextResponse.json(
          { error: error.message, details: error.details, code: error.code },
          { status: 500 }
        );
      }

      return NextResponse.json(normalizeRows(data));
    }

    // 🔹 Get all bookings
    const { data, error } = await supabase
      .from("bookings")
      .select("therapist_id, date, time")
      .order("therapist_id", { ascending: true })
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error) {
      console.error("GET ERROR (all bookings):", error);
      return NextResponse.json(
        { error: error.message, details: error.details, code: error.code },
        { status: 500 }
      );
    }

    const bookings = data.reduce((acc, row) => {
      const therapistBookings = acc[row.therapist_id] || {};
      const key = row.date;

      if (!therapistBookings[key]) therapistBookings[key] = [];
      therapistBookings[key].push(row.time);

      acc[row.therapist_id] = therapistBookings;
      return acc;
    }, {});

    return NextResponse.json(bookings);
  } catch (err) {
    console.error("UNEXPECTED GET ERROR:", err);
    return NextResponse.json(
      { error: "Unexpected server error", details: err.message },
      { status: 500 }
    );
  }
}

// ✅ POST BOOKING
export async function POST(request) {
  try {
    const body = await request.json();

    const {
      therapistId,
      dateKey,
      time,
      name,
      email,
      phone,
      contactMethod,
    } = body;

    // ✅ Validate input
    if (!therapistId || !dateKey || !time || !name || !email || !phone || !contactMethod) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ✅ Insert directly (DB constraint will handle duplicates)
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

    // 🔴 Handle errors
    if (error) {
      console.error("INSERT ERROR:", error);

      // 🔥 UNIQUE constraint error (duplicate slot)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This time slot is already booked." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
          code: error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (err) {
    console.error("UNEXPECTED POST ERROR:", err);

    return NextResponse.json(
      {
        error: "Unexpected server error",
        details: err.message,
      },
      { status: 500 }
    );
  }
}