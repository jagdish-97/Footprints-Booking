import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

// 🔹 Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

function normalizeRows(rows) {
  return rows.reduce((acc, row) => {
    const key = row.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row.time);
    return acc;
  }, {});
}

// ===============================
// 📌 GET BOOKINGS (Database details untouched)
// ===============================
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
        return NextResponse.json({ error: error.message }, { status: 500 });
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

// ===============================
// 📌 POST BOOKING + RESEND EMAILS
// ===============================
export async function POST(request) {
  try {
    const body = await request.json();

    const {
      therapistId,
      therapistName, // 🔹 Passed from frontend
      dateKey,
      time,
      name,
      email,
      phone,
      contactMethod,
    } = body;

    // Validate input
    if (!therapistId || !dateKey || !time || !name || !email || !phone || !contactMethod) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ===============================
    // 📌 INSERT BOOKING (Database details untouched)
    // ===============================
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
      console.error("INSERT ERROR:", error);
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This time slot is already booked." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ===============================
    // 📌 EMAIL: RESEND NOTIFICATIONS
    // ===============================
    try {
      // Promise.all ensures both emails are fully processed 
      // before the serverless function terminates.
      const emailResponses = await Promise.all([
        // 1. Admin Notification
        resend.emails.send({
          from: 'onboarding@resend.dev',
          to: 'jagdish@footprintstofeelbetter.com', // Admin testing email
          subject: `New Booking: ${name} with ${therapistName || "Therapist"}`,
          html: `
            <div style="font-family: sans-serif; color: #333;">
              <h2>New Booking Received</h2>
              <p><b>Client Name:</b> ${name}</p>
              <p><b>Therapist:</b> ${therapistName || "Not Specified"}</p>
              <p><b>Date:</b> ${dateKey}</p>
              <p><b>Time:</b> ${time}</p>
              <p><b>Client Phone:</b> ${phone}</p>
              <p><b>Client Email:</b> ${email}</p>
              <p><b>Preferred Contact:</b> ${contactMethod}</p>
            </div>
          `,
        }),
        // 2. Client Confirmation
        resend.emails.send({
          from: 'onboarding@resend.dev',
          to: email,
          subject: "Your Consultation is Confirmed",
          html: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px;">
              <h2>Booking Confirmed</h2>
              <p>Hi ${name},</p>
              <p>Your consultation with <b>${therapistName || "our therapist"}</b> is confirmed.</p>
              <p><b>Date:</b> ${dateKey}</p>
              <p><b>Time:</b> ${time}</p>
              <p>We will contact you via ${contactMethod}.</p>
              <br/>
              <p>Thank you,<br/>Footprints Team</p>
            </div>
          `,
        }),
      ]);

      // Log the actual response from Resend for verification
      console.log("✅ Resend Response:", JSON.stringify(emailResponses));
    } catch (mailError) {
      console.error("❌ RESEND ERROR:", mailError);
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("UNEXPECTED POST ERROR:", err);
    return NextResponse.json(
      { error: "Unexpected server error", details: err.message },
      { status: 500 }
    );
  }
}