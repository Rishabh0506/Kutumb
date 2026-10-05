export const calcAge = (birthDate, deathDate) => {
  if (!birthDate) return null;
  const end = deathDate ? new Date(deathDate) : new Date();
  const start = new Date(birthDate);
  return Math.floor((end - start) / (365.25 * 24 * 3600 * 1000));
};
