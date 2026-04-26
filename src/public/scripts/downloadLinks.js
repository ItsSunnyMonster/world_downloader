const downloadLinks = document.querySelectorAll("a[data-dl-filename]");

async function refreshDownloadLink(link) {
  if (link.dataset.inflight) return;
  link.dataset.inflight = "true";
  try {
    const filename = link.dataset.dlFilename;
    const { url } = await fetch(
      `/api/download?file=${encodeURIComponent(filename)}`,
    ).then((r) => r.json());
    link.href = url;
  } finally {
    delete link.dataset.inflight;
  }
}

downloadLinks.forEach((link) => {
  // refreshDownloadLink(link);
  link.addEventListener("mouseenter", () => refreshDownloadLink(link));
});
