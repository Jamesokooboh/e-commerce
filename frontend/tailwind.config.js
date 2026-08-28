/** @type { import("tailwindcss").Config } */
module.exports = {
    content: [
        "./public/index.html",
        "./src/**/*.js"
    ],
    theme: {
        extend: {
            colors: {
                paper: "#faf8f3",
                surface: "#ffffff",
                ink: "#1c1f1a",
                muted: "#6f7566",
                line: "#e4e0d2",
                accent: {
                    DEFAULT: "#d19a3d",
                    ink: "#8a5a17",
                    soft: "#f6e6c4"
                },
                accent2: {
                    DEFAULT: "#1f8a7a",
                    ink: "#146358",
                    soft: "#dcf0ec"
                }
            },
            fontFamily: {
                display: ["Fraunces", "ui-serif", "serif"],
                sans: ["\"Work Sans\"", "ui-sans-serif", "sans-serif"],
                mono: ["\"IBM Plex Mono\"", "ui-monospace", "monospace"]
            },
            animation: {
                fadeIn: "fadeIn 0.5s ease-out",
                fadeOut: "fadeOut 0.5s ease-in forwards"
            },
            keyframes: {
                fadeIn: {
                    "0%": {
                        opacity: "0"
                    },
                    "100%": {
                        opacity: "1"
                    }
                },
                fadeOut: {
                    "0%": {
                        opacity: "1"
                    },
                    "100%": {
                        opacity: "0"
                    }
                }
            }
        }
    },
    plugins: []
}