(() => {
    "use strict";
    try {
        const savedTheme = localStorage.getItem("pa_theme");
        const theme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
        document.documentElement.setAttribute("data-theme", theme);
    } catch (e) {
        document.documentElement.setAttribute("data-theme", "dark");
    }
})();
