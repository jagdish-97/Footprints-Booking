module.exports = {
    content: [
        "./src/**/*.{js,jsx}"
    ],
    theme: {
        extend: {
            colors: {
                blush: "#fff6f4",
                rosewood: "#6f2143",
                clay: "#b96573",
                berry: "#8d244c",
                shell: "#fffdfc",
                ink: "#2b1d22",
                mist: "#f5e6e4",
                sage: "#dff3ea",
                sageText: "#1d6a49"
            },
            fontFamily: {
                heading: ["Plus Jakarta Sans", "sans-serif"],
                body: ["Manrope", "sans-serif"]
            },
            boxShadow: {
                glow: "0 20px 60px rgba(111, 33, 67, 0.14)"
            },
        },
    },
    plugins: [require("@tailwindcss/forms")],
};