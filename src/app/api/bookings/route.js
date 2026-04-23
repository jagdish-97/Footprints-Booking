import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import nodemailer from "nodemailer"; // 🔹 Switched from Resend to Nodemailer

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
// 📌 POST BOOKING + SMTP EMAILS
// ===============================
export async function POST(request) {
  try {
    const body = await request.json();

    const {
      therapistId,
      therapistName,
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
    // 📌 EMAIL: NODEMAILER (HOSTINGER SMTP)
    // ===============================
    try {
      // 1. Create the Hostinger Transporter
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: true, // true for 465
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // 2. Define the Admin Notification
      const adminMail = {
        from: `"Footprints Admin" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_USER, // This will forward to your Gmail automatically
        replyTo: email, // Reply directly to the client from your Gmail!
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
      };

      // 3. Define the Client Confirmation
      const clientMail = {
        from: `"Footprints" <${process.env.SMTP_USER}>`,
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
      };

      // Send both emails
      await Promise.all([
        transporter.sendMail(adminMail),
        transporter.sendMail(clientMail)
      ]);

      console.log("✅ SMTP Emails sent successfully");
    } catch (mailError) {
      console.error("❌ SMTP ERROR:", mailError);
      // We don't return an error here because the DB insertion was successful.
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