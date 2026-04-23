"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export const dynamic = 'force-dynamic';

const DEFAULT_TIME_BATCH = 6;
const DEFAULT_DATE_BATCH = 8;

const bookingFallbackTherapists = [
    {
        id: "siham-abdelqader",
        name: "Siham Abdelqader",
        image:
            "https://img1.wsimg.com/isteam/ip/be3b4275-20eb-4372-92a9-bcc3a138027c/Siham%20Pic%202.jpg",
        title: "MHC-LP",
        location: "NY",
        specialties: ["Depression", "Anxiety", "Trauma"],
        languages: ["English", "Arabic"],
        therapyTypes: ["Individual", "Family"],
        price: 165,
        availability: "Available",
        summary:
            "Values multiculturalism, cultural awareness, compassion, and empathy. Experienced supporting clients with depression, anxiety, trauma, self-esteem, stress management, and family or marital conflicts.",
    },
];

const validationMessages = {
    clientName: "Please enter your full name.",
    clientEmail: "Please enter a valid email address.",
    clientPhone: "Please enter a valid phone number.",
    contactMethod: "Please choose a preferred contact method.",
    clientNotes: "Please share a short note about what support you need.",
    consent: "Please agree before confirming the consultation request.",
};

const initialFormFields = {
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    contactMethod: "Email",
    consent: false,
};

export default function BookingPage() {
    const [therapist, setTherapist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [availabilityByDate, setAvailabilityByDate] = useState({});
    const [orderedDates, setOrderedDates] = useState([]);
    const [visibleDateStart, setVisibleDateStart] = useState(0);
    const [visibleTimeCount, setVisibleTimeCount] = useState(DEFAULT_TIME_BATCH);
    const [selectedDateKey, setSelectedDateKey] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [detailsEnabled, setDetailsEnabled] = useState(false);
    const [formFields, setFormFields] = useState(initialFormFields);
    const [formErrors, setFormErrors] = useState({});
    const [formStatus, setFormStatus] = useState("");
    const [confirmation, setConfirmation] = useState({ visible: false, text: "" });
    const [submitting, setSubmitting] = useState(false);
    const detailsPanelRef = useRef(null);

    const selectedDay = useMemo(
        () => (selectedDateKey ? availabilityByDate[selectedDateKey] : null),
        [availabilityByDate, selectedDateKey]
    );

    const visibleDates = useMemo(
        () => orderedDates.slice(visibleDateStart, visibleDateStart + DEFAULT_DATE_BATCH),
        [orderedDates, visibleDateStart]
    );

    const canContinue = Boolean(selectedDateKey && selectedTime);
    const shouldShowMoreTimes = selectedDay ? selectedDay.slots.length > visibleTimeCount : false;

    const slotHelperText = selectedDay
        ? selectedDay.slots.length
            ? `${selectedDay.slots.length} available time slots on ${selectedDay.fullLabel}.`
            : "That day is fully booked. Please choose another date."
        : "Select a date first.";

    useEffect(() => {
        async function initPage() {
            try {
                setLoading(true);
                const therapists = await loadBookingTherapists();
                const selectedTherapist = resolveTherapistFromQuery(therapists);
                
                if (!selectedTherapist) {
                    setError("No therapist available. Please try again.");
                    return;
                }
                
                const bookedSlots = await fetchBookedSlots(selectedTherapist.id);
                const availability = buildAvailabilityMap(selectedTherapist, bookedSlots);
                const ordered = Object.keys(availability)
                    .filter((key) => availability[key].slots.length > 0)
                    .sort((left, right) => left.localeCompare(right));

                setTherapist(selectedTherapist);
                setAvailabilityByDate(availability);
                setOrderedDates(ordered);
                setError(null);
            } catch (err) {
                console.error("Error initializing booking page:", err);
                setError(`Error loading booking page: ${err.message}`);
            } finally {
                setLoading(false);
            }
        }

        initPage();
    }, []);

    useEffect(() => {
        if (therapist) {
            document.title = `Book Consultation with ${therapist.name} | Footprints to Feel Better`;
        }
    }, [therapist]);

    const handleSelectDate = (dateKey) => {
        const dayData = availabilityByDate[dateKey];
        if (!dayData || !dayData.slots.length) {
            return;
        }

        const index = orderedDates.indexOf(dateKey);
        const nextStart = index === -1 ? 0 : Math.floor(index / DEFAULT_DATE_BATCH) * DEFAULT_DATE_BATCH;

        setSelectedDateKey(dateKey);
        setSelectedTime(null);
        setVisibleTimeCount(DEFAULT_TIME_BATCH);
        setVisibleDateStart(nextStart);
        setDetailsEnabled(false);
        setFormStatus("");
        setConfirmation({ visible: false, text: "" });
    };

    const handleSelectTime = (time) => {
        setSelectedTime(time);
        setDetailsEnabled(true);
        setFormStatus("");
        setConfirmation({ visible: false, text: "" });
    };

    const handleContinue = () => {
        if (!canContinue) {
            return;
        }

        setDetailsEnabled(true);
        detailsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const handleFieldChange = (event) => {
        const { name, type, value, checked } = event.target;
        const nextValue = type === "checkbox" ? checked : value;

        setFormFields((prev) => ({
            ...prev,
            [name]: nextValue,
        }));

        setFormErrors((prev) => ({
            ...prev,
            [name]: "",
        }));
        setFormStatus("");
    };

    const validateField = (name, value) => {
        let errorMessage = "";

        if (name === "consent") {
            if (!value) {
                errorMessage = validationMessages[name];
            }
        } else if (!value?.toString().trim()) {
            errorMessage = validationMessages[name];
        } else if (name === "clientEmail" && !isValidEmail(value)) {
            errorMessage = validationMessages.clientEmail;
        } else if (name === "clientPhone" && !isValidPhone(value)) {
            errorMessage = validationMessages.clientPhone;
        }

        setFormErrors((prev) => ({
            ...prev,
            [name]: errorMessage,
        }));

        return !errorMessage;
    };

    const validateForm = () => {
        const nextErrors = {};
        let isValid = true;

        Object.entries(formFields).forEach(([name, value]) => {
            const fieldIsValid = validateField(name, value);
            if (!fieldIsValid) {
                isValid = false;
                nextErrors[name] = validationMessages[name];
            }
        });

        setFormErrors(nextErrors);
        return isValid;
    };

    const handleBookingSubmit = async (event) => {
        event.preventDefault();

        if (submitting) return; // ✅ prevent double click

        setSubmitting(true); // ✅ start loading
        setFormStatus("");
        setConfirmation({ visible: false, text: "" });

        if (!validateForm()) {
            setFormStatus(
                "Please complete the required fields before confirming the consultation request."
            );
            setSubmitting(false); // ✅ reset
            return;
        }

        if (!selectedDay || !selectedDay.slots.includes(selectedTime)) {
            resolveBookingConflict();
            setSubmitting(false); // ✅ reset
            return;
        }

        try {
            await postBookedSlot(therapist.id, selectedDateKey, selectedTime, formFields);

            updateAvailabilityAfterBooking(selectedDateKey, selectedTime);

            const clientName = formFields.clientName.trim() || "The client";

            setConfirmation({
                visible: true,
                text: `Your consultation request has been received. ${clientName} has requested ${selectedDay.fullLabel} at ${selectedTime} with ${therapist.name}.Our team will confirm availability and follow up shortly.`
            });

            resetBookingFlow();
        } catch (error) {
            console.error("Failed to save booking", error);
            setFormStatus(
                "Unable to complete the booking request. Please try again in a moment."
            );
        } finally {
            setSubmitting(false); // ✅ ALWAYS reset
        }
    };

    const handleDatePager = (direction) => {
        const maxStart = Math.max(0, orderedDates.length - DEFAULT_DATE_BATCH);
        setVisibleDateStart((current) => {
            const next = current + direction * DEFAULT_DATE_BATCH;
            return Math.min(maxStart, Math.max(0, next));
        });
    };

    const handleShowMoreTimes = () => {
        if (!selectedDay) {
            return;
        }

        setVisibleTimeCount((count) => Math.min(selectedDay.slots.length, count + DEFAULT_TIME_BATCH));
    };

    const updateAvailabilityAfterBooking = (dateKey, time) => {
        setAvailabilityByDate((prev) => {
            const next = { ...prev };
            const dayData = next[dateKey];

            if (!dayData) {
                return prev;
            }

            const updatedDay = {
                ...dayData,
                slots: dayData.slots.filter((slot) => slot !== time),
            };

            if (updatedDay.slots.length) {
                next[dateKey] = updatedDay;
            } else {
                delete next[dateKey];
            }

            return next;
        });

        setOrderedDates((prev) => {
            const day = availabilityByDate[dateKey];
            if (!day || day.slots.length <= 1) {
                return prev.filter((key) => key !== dateKey);
            }
            return prev;
        });
    };

    const findNextAvailableSlot = (startDateKey) => {
        const entries = Object.entries(availabilityByDate)
            .filter(([, dayData]) => dayData.slots.length > 0)
            .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

        if (!entries.length) {
            return null;
        }

        const startIndex = entries.findIndex(([dateKey]) => dateKey >= startDateKey);
        const normalizedStart = startIndex === -1 ? 0 : startIndex;

        for (let index = normalizedStart; index < entries.length; index += 1) {
            const [dateKey, dayData] = entries[index];
            if (dayData.slots.length) {
                return { dateKey, time: dayData.slots[0], dayData };
            }
        }

        for (let index = 0; index < normalizedStart; index += 1) {
            const [dateKey, dayData] = entries[index];
            if (dayData.slots.length) {
                return { dateKey, time: dayData.slots[0], dayData };
            }
        }

        return null;
    };

    const getVisibleDateStartForDate = (dateKey) => {
        const index = orderedDates.indexOf(dateKey);
        if (index === -1) {
            return 0;
        }

        return Math.floor(index / DEFAULT_DATE_BATCH) * DEFAULT_DATE_BATCH;
    };

    const resolveBookingConflict = () => {
        const fallback = findNextAvailableSlot(selectedDateKey);

        if (!fallback) {
            setFormStatus(
                "That therapist no longer has open slots in the current schedule. Please choose another therapist or come back later."
            );
            setSelectedDateKey(null);
            setSelectedTime(null);
            setVisibleTimeCount(DEFAULT_TIME_BATCH);
            setDetailsEnabled(false);
            return;
        }

        setSelectedDateKey(fallback.dateKey);
        setSelectedTime(fallback.time);
        setVisibleDateStart(getVisibleDateStartForDate(fallback.dateKey));
        setVisibleTimeCount(Math.max(DEFAULT_TIME_BATCH, fallback.dayData.slots.indexOf(fallback.time) + 1));
        setDetailsEnabled(true);
        setFormStatus(
            `That exact time is no longer available. We moved this booking to the next open slot: ${fallback.dayData.fullLabel} at ${fallback.time}.`
        );
    };

    const resetBookingFlow = () => {
        setFormFields(initialFormFields);
        setFormErrors({});
        setSelectedDateKey(null);
        setSelectedTime(null);
        setVisibleTimeCount(DEFAULT_TIME_BATCH);
        setVisibleDateStart(0);
        setDetailsEnabled(false);
    };

    if (loading) {
        return (
            <main className="relative bg-blush text-ink min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-lg font-semibold">Loading therapist details...</p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="relative bg-blush text-ink min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md">
                    <p className="text-lg font-semibold text-red-600 mb-4">Error</p>
                    <p className="text-base mb-6">{error}</p>
                    <a href="/clinical-staff.html" className="inline-block px-6 py-3 bg-rosewood text-white rounded-full hover:bg-opacity-90 transition">
                        Back to Therapists
                    </a>
                </div>
            </main>
        );
    }

    if (!therapist) {
        return (
            <main className="relative bg-blush text-ink min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-lg">Therapist not found. Please try again.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="relative bg-blush text-ink min-h-screen">
            <div className="fixed inset-0 -z-10 overflow-hidden">
                <div className="absolute left-0 top-0 h-80 w-80 rounded-full bg-[#ffd7df] blur-3xl opacity-70" />
                <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-[#f1c7b4] blur-3xl opacity-60" />
                <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-[#e2efe8] blur-3xl opacity-70" />
            </div>

            <header className="border-b border-white bg-[#fae8e1]">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
                    <a href="https://meetfootprints.com/index.html" className="flex items-center gap-3">
                      
                        <div>
                            <p className="font-heading text-lg font-extrabold tracking-tight text-rosewood">
                                Footprints to Feel Better
                            </p>
                            <p className="text-sm text-[#7b6169]">Consultation Booking</p>
                        </div>
                    </a>
                    <a
                        href="https://meetfootprints.com/clinical-staff.html"
                        className="inline-flex items-center rounded-full border border-rosewood/15 bg-white px-4 py-2 text-sm font-semibold text-rosewood transition hover:-translate-y-0.5 hover:bg-[#6f2143] hover:text-white"
                    >
                        Back to therapists
                    </a>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-14">
                <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#6f2143] via-[#9b3a5a] to-[#c15a6d] p-8 text-white shadow-glow lg:p-10">
                        <div className="max-w-2xl">
                            <p className="mb-4 inline-flex rounded-full bg-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white/90">
                                Personalized Consultation
                            </p>
                            <h1 className="font-heading text-4xl font-extrabold leading-tight lg:text-5xl">
                                Choose a time that feels manageable, calm, and right for you.
                            </h1>
                            <p className="mt-5 max-w-xl text-base leading-7 text-white/85 lg:text-lg">
                                Start with therapist availability, pick a session time, then continue with the remaining booking details in one smooth flow.
                            </p>
                        </div>

                        <div className="mt-10 grid gap-4 md:grid-cols-3">
                            <div className="rounded-3xl bg-white/12 p-5 backdrop-blur">
                                <p className="text-sm font-semibold text-white/70">Step 1</p>
                                <p className="mt-2 font-heading text-xl font-bold">Select a date</p>
                                <p className="mt-2 text-sm leading-6 text-white/80">Browse upcoming availability without leaving the page.</p>
                            </div>
                            <div className="rounded-3xl bg-white/12 p-5 backdrop-blur">
                                <p className="text-sm font-semibold text-white/70">Step 2</p>
                                <p className="mt-2 font-heading text-xl font-bold">Choose a time</p>
                                <p className="mt-2 text-sm leading-6 text-white/80">Every slot updates the booking summary instantly.</p>
                            </div>
                            <div className="rounded-3xl bg-white/12 p-5 backdrop-blur">
                                <p className="text-sm font-semibold text-white/70">Step 3</p>
                                <p className="mt-2 font-heading text-xl font-bold">Finish details</p>
                                <p className="mt-2 text-sm leading-6 text-white/80">After time selection, the intake step opens below.</p>
                            </div>
                        </div>
                    </div>

                    <aside className="rounded-[2rem] bg-white/90 p-6 shadow-glow ring-1 ring-[#f1d7db] lg:p-7">
                        <div className="flex items-start gap-4">
                            <img
                                src={therapist?.image || "/data/portraits/portrait.svg"}
                                alt={therapist?.name || "Selected therapist"}
                                className="h-20 w-20 rounded-3xl object-cover bg-mist"
                            />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">Selected therapist</p>
                                <h2 className="mt-2 font-heading text-2xl font-extrabold text-rosewood">
                                    {therapist?.name || "Loading..."}
                                </h2>
                                <p className="mt-1 text-sm text-[#7b6169]">
                                    {therapist ? `${therapist.title} | ${therapist.location} | ${therapist.languages.join(", ")}` : "Loading therapist details..."}
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl bg-[#fff7f7] p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay">Session rate</p>
                                <p className="mt-2 font-heading text-2xl font-bold text-ink">
                                    {therapist ? formatPrice(therapist.price) : "-"}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-[#fff7f7] p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay">Availability</p>
                                <p className="mt-2 font-heading text-2xl font-bold text-ink">
                                    {therapist?.availability || "-"}
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 rounded-3xl bg-[#fffaf9] p-5 ring-1 ring-[#f2e2df]">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay">Booking summary</p>
                            <div className="mt-4 space-y-3 text-sm text-[#5d4a50]">
                                <div className="flex items-center justify-between gap-3">
                                    <span>Date</span>
                                    <span className="font-semibold text-ink">{selectedDay?.fullLabel || "Choose a date"}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Time</span>
                                    <span className="font-semibold text-ink">{selectedTime || "Choose a time"}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Format</span>
                                    <span className="font-semibold text-ink">Video consultation</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleContinue}
                                disabled={!canContinue}
                                className={`mt-6 w-full rounded-full px-5 py-3.5 text-sm font-bold text-white transition 
    ${canContinue
                                    ? "bg-[rgb(111,33,67)] hover:-translate-y-0.5 cursor-pointer"
                                        : "cursor-not-allowed bg-[#dfc2c8] text-[#8f7078]"
                                    }`}
                            >
                                Continue to details
                            </button>
                        </div>

                        <div className="mt-6 rounded-3xl bg-sage p-5 text-sageText">
                            <p className="font-heading text-lg font-bold">What happens next?</p>
                            <p className="mt-2 text-sm leading-6">
                                Once the client clicks a time slot, the remaining booking process opens automatically below with contact details and consultation notes.
                            </p>
                        </div>
                    </aside>
                </section>

                <section className="mt-10 grid gap-8 xl:grid-cols-[1fr_0.82fr]">
                    <div className="rounded-[2rem] bg-white/90 p-6 shadow-glow ring-1 ring-[#f1d7db] lg:p-8">
                        <div className="flex flex-col gap-4 border-b border-[#f2dfe2] pb-6 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">Availability</p>
                                <h2 className="mt-2 font-heading text-3xl font-extrabold text-rosewood">Pick an appointment window</h2>
                            </div>
                            <p className="max-w-md text-sm leading-6 text-[#6c5960]">
                                The schedule below updates per therapist. Available clinicians show more options, limited clinicians show fewer, and waitlist therapists show the soonest openings.
                            </p>
                        </div>

                        <div className="mt-8">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="font-heading text-xl font-bold text-ink">Available dates</h3>
                                    <p id="date-range-label" className="mt-1 text-sm text-[#6c5960]">
                                        {visibleDates.length
                                            ? `Showing ${availabilityByDate[visibleDates[0]]?.fullLabel} to ${availabilityByDate[visibleDates[visibleDates.length - 1]]?.fullLabel}.`
                                            : "Showing upcoming availability."}
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleDatePager(-1)}
                                        disabled={visibleDateStart === 0}
                                        className="rounded-full border border-[#e7cfd4] bg-[#fffafa] px-4 py-2 text-sm font-semibold text-rosewood transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Earlier dates
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDatePager(1)}
                                        disabled={visibleDateStart + DEFAULT_DATE_BATCH >= orderedDates.length}
                                        className="rounded-full border border-[#e7cfd4] bg-[#fffafa] px-4 py-2 text-sm font-semibold text-rosewood transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Later dates
                                    </button>
                                </div>
                            </div>

                            <div id="date-options" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {visibleDates.map((dateKey) => {
                                    const dayData = availabilityByDate[dateKey];
                                    const isSelected = selectedDateKey === dateKey;

                                    return (
                                        <button
                                            key={dateKey}
                                            type="button"
                                            onClick={() => handleSelectDate(dateKey)}
                                            className={`rounded-[1.75rem] border p-5 text-left transition ${isSelected
                                                    ? "border-[#6f2143] bg-[#6f2143] text-white shadow-glow"
                                                    : "border-[#edd9dd] bg-[#fffafa] hover:-translate-y-0.5 hover:border-[#6f2143]/40 hover:bg-white"
                                                }`}
                                        >
                                            <span
                                                className={`text-xs font-semibold uppercase tracking-[0.16em] ${isSelected ? "text-white/80" : "text-clay"
                                                    }`}
                                            >
                                                {dayData.label.dayName}
                                            </span>

                                            <span
                                                className={`mt-2 block font-heading text-2xl font-extrabold ${isSelected ? "text-white" : "text-ink"
                                                    }`}
                                            >
                                                {dayData.label.dayNumber}
                                            </span>

                                            <span
                                                className={`mt-1 block text-sm ${isSelected ? "text-white/80" : "text-[#6c5960]"
                                                    }`}
                                            >
                                                {dayData.label.monthName}
                                            </span>

                                            <span
                                                className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isSelected
                                                        ? "bg-white/15 text-white"
                                                        : "bg-[#fff0f4] text-[#6f2143]"
                                                    }`}
                                            >
                                                {dayData.slots.length} open
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-10">
                            <div className="flex items-center justify-between gap-4">
                                <h3 className="font-heading text-xl font-bold text-ink">Time slots</h3>
                                <p id="slot-helper" className="text-sm text-[#6c5960]">
                                    {slotHelperText}
                                </p>
                            </div>

                            <div id="time-slots" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {selectedDay ? (
                                    selectedDay.slots.slice(0, visibleTimeCount).map((slot) => (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() => handleSelectTime(slot)}
                                            className={`rounded-[1.5rem] border p-4 text-left transition ${selectedTime === slot
                                                    ? "border-[#6f2143] bg-[#6f2143] text-white shadow-glow"
                                                    : "border-[#edd9dd] bg-[#fffafa] hover:-translate-y-0.5 hover:border-[#6f2143]/40 hover:bg-white"
                                                }`}
                                        >
                                            <span className="font-heading text-lg font-bold">{slot}</span>
                                            <span
                                                className={`mt-1 block text-sm ${selectedTime === slot ? "text-white/90" : "text-[#6c5960]"
                                                    }`}
                                            >
                                                50-minute video consultation
                                            </span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="col-span-full rounded-[1.75rem] border border-dashed border-[#e6ced3] bg-[#fffafa] p-8 text-center text-sm text-[#7b6169]">
                                        Available consultation times will appear here after you choose a date.
                                    </div>
                                )}
                            </div>

                            {selectedDay && !selectedDay.slots.length && (
                                <div className="mt-4 col-span-full rounded-[1.75rem] border border-dashed border-[#e6ced3] bg-[#fffafa] p-8 text-center text-sm text-[#7b6169]">
                                    All times for this day have already been reserved.
                                </div>
                            )}

                            <div className="mt-4">
                                <button
                                    type="button"
                                    onClick={handleShowMoreTimes}
                                    className={`${shouldShowMoreTimes ? "inline-flex" : "hidden"
                                        } rounded-full border border-[#6f2143]/30 bg-[#fffafa] px-4 py-2 text-sm font-semibold text-[#6f2143] transition hover:-translate-y-0.5 hover:bg-[#6f2143] hover:text-white`}
                                >
                                    Show more times
                                </button>
                            </div>
                        </div>
                    </div>

                    <div
                        id="details-panel"
                        ref={detailsPanelRef}
                        className={`rounded-[2rem] bg-white/90 p-6 shadow-glow ring-1 ring-[#f1d7db] lg:p-8 transition ${!detailsEnabled ? "opacity-60" : "opacity-100"}`}
                    >
                        <div className="border-b border-[#f2dfe2] pb-6">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">Remaining process</p>
                            <h2 className="mt-2 font-heading text-3xl font-extrabold text-rosewood">Client details</h2>
                            <p id="details-copy" className="mt-3 text-sm leading-6 text-[#6c5960]">
                                {detailsEnabled
                                    ? `You selected ${selectedDay?.fullLabel || "a date"} at ${selectedTime}. Complete the client details to continue the booking request.`
                                    : "Select a time first to unlock the rest of the consultation booking flow."}
                            </p>
                        </div>

                        <form id="booking-form" className="mt-8 space-y-5" onSubmit={handleBookingSubmit} noValidate>
                            <input type="hidden" name="therapist_id" value={therapist?.id || ""} />
                            <div className={`${formStatus ? "block" : "hidden"} rounded-3xl border border-[#f3c0c8] bg-[#fff2f4] px-4 py-3 text-sm text-[#8b274e]`}>
                                {formStatus}
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <label className="block">
                                    <span className="mb-2 block text-sm font-semibold text-[#5d4a50]">Full name</span>
                                    <input
                                        name="clientName"
                                        placeholder="Your full name"
                                        required
                                        value={formFields.clientName}
                                        onChange={handleFieldChange}
                                        disabled={!detailsEnabled}
                                        aria-describedby="clientName-error"
                                        className="w-full rounded-2xl border-[#edd9dd] bg-[#fffafa] px-4 py-3 text-sm focus:border-rosewood focus:ring-rosewood"
                                    />
                                    <p id="clientName-error" className={`${formErrors.clientName ? "mt-2 block text-sm text-[#b42318]" : "hidden"}`}>
                                        {formErrors.clientName}
                                    </p>
                                </label>
                                <label className="block">
                                    <span className="mb-2 block text-sm font-semibold text-[#5d4a50]">Email address</span>
                                    <input
                                        type="email"
                                        name="clientEmail"
                                        placeholder="name@example.com"
                                        required
                                        value={formFields.clientEmail}
                                        onChange={handleFieldChange}
                                        disabled={!detailsEnabled}
                                        aria-describedby="clientEmail-error"
                                        className="w-full rounded-2xl border-[#edd9dd] bg-[#fffafa] px-4 py-3 text-sm focus:border-rosewood focus:ring-rosewood"
                                    />
                                    <p id="clientEmail-error" className={`${formErrors.clientEmail ? "mt-2 block text-sm text-[#b42318]" : "hidden"}`}>
                                        {formErrors.clientEmail}
                                    </p>
                                </label>
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <label className="block">
                                    <span className="mb-2 block text-sm font-semibold text-[#5d4a50]">Phone number</span>
                                    <input
                                        type="tel"
                                        name="clientPhone"
                                        placeholder="(555) 123-4567"
                                        required
                                        value={formFields.clientPhone}
                                        onChange={handleFieldChange}
                                        disabled={!detailsEnabled}
                                        aria-describedby="clientPhone-error"
                                        className="w-full rounded-2xl border-[#edd9dd] bg-[#fffafa] px-4 py-3 text-sm focus:border-rosewood focus:ring-rosewood"
                                    />
                                    <p id="clientPhone-error" className={`${formErrors.clientPhone ? "mt-2 block text-sm text-[#b42318]" : "hidden"}`}>
                                        {formErrors.clientPhone}
                                    </p>
                                </label>
                                <label className="block">
                                    <span className="mb-2 block text-sm font-semibold text-[#5d4a50]">Preferred contact</span>
                                    <select
                                        name="contactMethod"
                                        required
                                        value={formFields.contactMethod}
                                        onChange={handleFieldChange}
                                        disabled={!detailsEnabled}
                                        aria-describedby="contactMethod-error"
                                        className="w-full rounded-2xl border-[#edd9dd] bg-[#fffafa] px-4 py-3 text-sm focus:border-rosewood focus:ring-rosewood"
                                    >
                                        <option>Email</option>
                                        <option>Phone</option>
                                        <option>Text message</option>
                                    </select>
                                    <p id="contactMethod-error" className={`${formErrors.contactMethod ? "mt-2 block text-sm text-[#b42318]" : "hidden"}`}>
                                        {formErrors.contactMethod}
                                    </p>
                                </label>
                            </div>

                            <label className="flex items-start gap-3 rounded-3xl bg-[#fff9f8] p-4 text-sm text-[#5d4a50]">
                                <input
                                    type="checkbox"
                                    name="consent"
                                    required
                                    checked={formFields.consent}
                                    onChange={handleFieldChange}
                                    disabled={!detailsEnabled}
                                    aria-describedby="consent-error"
                                    className="mt-1 rounded border-[#d8b5bd] text-rosewood focus:ring-rosewood"
                                />
                                <span>I agree to be contacted by the Footprints team regarding this consultation request.</span>
                            </label>
                            <p id="consent-error" className={`${formErrors.consent ? "mt-[-0.5rem] block text-sm text-[#b42318]" : "hidden"}`}>
                                {formErrors.consent}
                            </p>

                            <button
                                type="submit"
                                disabled={!detailsEnabled || submitting}
                                className={`w-full rounded-full px-6 py-4 text-sm font-bold text-white transition 
    ${detailsEnabled && !submitting
                                    ? "bg-[rgb(111,33,67)] hover:-translate-y-0.5 cursor-pointer"
                                        : "cursor-not-allowed bg-[#dfc2c8] text-[#8f7078]"
                                    }`}
                            >
                                {submitting ? "Booking..." : "Confirm consultation request"}
                            </button>
                        </form>

                        <div className={`${confirmation.visible ? "mt-6 block" : "hidden"} rounded-[1.75rem] bg-green-200 p-6 text-sageText`}>
                            <p className="text-sm font-semibold uppercase tracking-[0.18em]">Request received</p>
                            <h3 className="mt-2 font-heading text-2xl font-extrabold">Consultation reserved</h3>
                            <p id="confirmation-text" className="mt-3 text-sm leading-6">{confirmation.text}</p>
                        </div>
                    </div>
                </section>
            </main>
        </main>
    );
}

async function loadBookingTherapists() {
    try {
        const response = await fetch("/data/therapists.json");
        if (!response.ok) {
            throw new Error("Could not load therapists data.");
        }

        return await response.json();
    } catch (error) {
        console.warn("Using fallback therapist data for booking page.", error);
        return bookingFallbackTherapists;
    }
}

async function fetchBookedSlots(therapistId) {
    try {
        const response = await fetch(`/api/bookings?therapistId=${encodeURIComponent(therapistId)}`);
        if (!response.ok) {
            throw new Error("Failed to load booked slots.");
        }

        return await response.json();
    } catch (error) {
        console.warn("Could not load booked slots from the server.", error);
        return {};
    }
}

async function postBookedSlot(therapistId, dateKey, time, formFields) {
    const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            therapistId,
            dateKey,
            time,
            name: formFields.clientName,
            email: formFields.clientEmail,
            phone: formFields.clientPhone,
            contactMethod: formFields.contactMethod,
        }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = payload?.error || payload?.details || "Could not save booking.";
        throw new Error(message);
    }

    return payload;
}

function resolveTherapistFromQuery(therapists) {
    if (typeof window === "undefined") {
        return therapists?.[0] || null;
    }

    try {
        const params = new URLSearchParams(window.location.search);
        const therapistId = params.get("therapist");
        
        if (!therapistId) {
            console.warn("No therapist ID in URL, using first therapist");
            return therapists?.[0] || null;
        }
        
        const found = therapists?.find((item) => item.id === therapistId);
        if (!found) {
            console.warn(`Therapist ${therapistId} not found, using first therapist`);
            return therapists?.[0] || null;
        }
        
        return found;
    } catch (error) {
        console.error("Error resolving therapist from query:", error);
        return therapists?.[0] || null;
    }
}

function buildAvailabilityMap(therapist, bookedSlots) {
    const map = {};
    const daysToGenerate = getDaysToGenerate(therapist.availability);
    const slotsPerDay = getSlotsForAvailability(therapist.availability);
    const date = new Date();
    const leadDays = therapist.availability === "Waitlist" ? 5 : 1;
    date.setDate(date.getDate() + leadDays);

    let generatedDays = 0;
    while (generatedDays < daysToGenerate) {
        if (date.getDay() === 0 || date.getDay() === 6) {
            date.setDate(date.getDate() + 1);
            continue;
        }

        const key = formatDateKey(date);
        const allSlots = rotateSlots(slotsPerDay, generatedDays);
        const reservedSlots = bookedSlots[key] || [];
        const openSlots = allSlots.filter((slot) => !reservedSlots.includes(slot));

        map[key] = {
            date: stripTime(date),
            fullLabel: formatReadableDate(date),
            label: formatDateCardLabel(date),
            slots: openSlots,
            totalSlots: allSlots.length,
        };

        generatedDays += 1;
        date.setDate(date.getDate() + 1);
    }

    return map;
}

function getSlotsForAvailability(status) {
    const slotLibrary = {
        Available: ["8:30 AM", "9:30 AM", "10:30 AM", "11:30 AM", "1:00 PM", "2:30 PM", "4:00 PM", "5:30 PM", "6:30 PM"],
        Limited: ["9:30 AM", "11:00 AM", "1:30 PM", "4:30 PM", "6:00 PM"],
        Waitlist: ["10:00 AM", "12:30 PM", "3:00 PM", "5:00 PM"],
    };

    return slotLibrary[status] || slotLibrary.Available;
}

function getDaysToGenerate(status) {
    const dayCounts = {
        Available: 90,
        Limited: 75,
        Waitlist: 60,
    };

    return dayCounts[status] || 90;
}

function rotateSlots(slots, offset) {
    if (!slots.length) {
        return [];
    }

    return slots.map((_, index) => slots[(index + offset) % slots.length]);
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10;
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDateCardLabel(date) {
    return {
        dayName: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
        dayNumber: new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(date),
        monthName: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date),
    };
}

function formatReadableDate(date) {
    return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
    }).format(date);
}

function formatPrice(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
