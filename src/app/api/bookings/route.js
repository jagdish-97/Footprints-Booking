import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import nodemailer from "nodemailer";

// 🔹 Helper: Convert rows into { date: [times] }
// Logic remains identical to your original code
function normalizeRows(rows) {
  return rows.reduce((acc, row) => {
    const key = row.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row.time);
    return acc;
  }, {});
}

// ===============================
// 📌 GET BOOKINGS
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
// 📌 SMTP TRANSPORT (ZOHO - OPTIMIZED)
// ===============================
const transporter = nodemailer.createTransport({
  host: "smtp.zoho.in",
  port: 465,
  secure: true, // TLS is more stable than SSL for serverless
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_APP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// ===============================
// 📌 POST BOOKING + EMAILS
// ===============================
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

    // 🔴 Validate input
    if (!therapistId || !dateKey || !time || !name || !email || !phone || !contactMethod) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ===============================
    // 📌 INSERT BOOKING (SUPABASE)
    // No changes made to DB interaction logic
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
    // 📌 EMAIL: NOTIFICATIONS (FIXED)
    // ===============================
    try {
      // Promise.all ensures both emails are fully processed 
      // BEFORE the function ends, preventing the "Connection Closed" error.
      await Promise.all([
        transporter.sendMail({
          from: process.env.ZOHO_EMAIL,
          to: "jaggu3526@gmail.com", // Admin email
          subject: "New Booking Received",
          html: `
            <h2>New Booking Received</h2>
            <p><b>Name:</b> ${name}</p>
            <p><b>Email:</b> ${email}</p>
            <p><b>Phone:</b> ${phone}</p>
            <p><b>Date:</b> ${dateKey}</p>
            <p><b>Time:</b> ${time}</p>
            <p><b>Contact Method:</b> ${contactMethod}</p>
          `,
        }),
        transporter.sendMail({
          from: process.env.ZOHO_EMAIL,
          to: email,
          subject: "Your Consultation is Confirmed",
          html: `
            <h2>Booking Confirmed</h2>
            <p>Hi ${name},</p>
            <p>Your consultation has been successfully booked.</p>
            <p><b>Date:</b> ${dateKey}</p>
            <p><b>Time:</b> ${time}</p>
            <p>We will contact you via ${contactMethod}.</p>
            <br/>
            <p>Thank you,<br/>Footprints Team</p>
          `,
        }),
      ]);
      console.log("✅ Emails sent successfully");
    } catch (mailError) {
      console.error("❌ EMAIL ERROR:", mailError);
      // DB remains updated even if mail fails
    }

    // ===============================
    // 📌 FINAL RESPONSE
    // ===============================
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