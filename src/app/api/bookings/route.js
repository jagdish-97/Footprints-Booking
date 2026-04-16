import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";


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
        console.error("GET ERROR:", error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json(normalizeRows(data));
    }

    const { data, error } = await supabase
      .from("bookings")
      .select("therapist_id, date, time");

    if (error) {
      console.error("GET ALL ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (err) {
    console.error("UNEXPECTED GET ERROR:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}

// ✅ POST BOOKING + EMAILS
export async function POST(request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
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

    // 🔴 Validate input
    if (!therapistId || !dateKey || !time || !name || !email || !phone || !contactMethod) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ✅ Insert booking
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

    // 🔴 Handle DB errors
    if (error) {
      console.error("INSERT ERROR:", error);

      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This time slot is already booked." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // ✅ SEND EMAILS (ADMIN + USER)
    try {
      // 📩 Admin Email
      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: "jaggu3526@gmail.com", // 🔴 CHANGE THIS
        subject: "New Booking Received",
        html: `
          <h2>New Booking</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Therapist ID:</strong> ${therapistId}</p>
          <p><strong>Date:</strong> ${dateKey}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Contact Method:</strong> ${contactMethod}</p>
        `,
      });

      // 📧 User Email
      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: email,
        subject: "Your Consultation is Confirmed",
        html: `
          <h2>Booking Confirmed</h2>
          <p>Hi ${name},</p>
          <p>Your consultation has been successfully booked.</p>
          <p><strong>Date:</strong> ${dateKey}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p>We will contact you via ${contactMethod}.</p>
          <br/>
          <p>Thank you,<br/>Footprints Team</p>
        `,
      });

    } catch (mailError) {
      console.error("EMAIL ERROR:", mailError);
      // ❗ Don't fail booking if email fails
    }

    // ✅ FINAL RESPONSE
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