const domainLabelPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
const topLevelDomainPattern = /^[a-z]{2,63}$/i;

export function isValidExternalHttpUrl(value: string) {
  const candidate = value.trim();
  if (!/^https?:\/\//i.test(candidate) || /\s/.test(candidate)) {
    return false;
  }

  try {
    const url = new URL(candidate);
    const labels = url.hostname.split(".");
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      labels.length >= 2 &&
      labels.every((label) => domainLabelPattern.test(label)) &&
      topLevelDomainPattern.test(labels.at(-1) || "")
    );
  } catch {
    return false;
  }
}
