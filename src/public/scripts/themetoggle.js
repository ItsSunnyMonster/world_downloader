function setTheme(mode) {
  localStorage.setItem("theme-storage", mode);
}

// Functions needed for the theme toggle
//

function toggleTheme() {
  console.log("Toggle");
  if (localStorage.getItem("theme-storage") === "light") {
    setTheme("dark");
    updateItemToggleTheme();
  } else if (localStorage.getItem("theme-storage") === "dark") {
    setTheme("light");
    updateItemToggleTheme();
  }
}

function updateItemToggleTheme() {
  console.log("Log");
  let mode = getSavedTheme();

  let htmlElement = document.querySelector("html");
  if (mode === "dark") {
    htmlElement.classList.remove("light");
    htmlElement.classList.add("dark");
  } else if (mode === "light") {
    htmlElement.classList.remove("dark");
    htmlElement.classList.add("light");
  }
}

function getSavedTheme() {
  let currentTheme = localStorage.getItem("theme-storage");
  if (!currentTheme) {
    console.log("Empty");
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      currentTheme = "dark";
      setTheme("dark");
    } else {
      currentTheme = "light";
      setTheme("light");
    }
  }

  return currentTheme;
}

window.addEventListener("load", () => {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", ({ matches: isDark }) => {
      let theme = isDark ? "dark" : "light";
      setTheme(theme);
      updateItemToggleTheme();
    });
});
