export const dateDiffString = (src: number, dst: number) => {
    const diff = (src - dst) / 1000;
    const seconds = Math.floor(diff % 60).toString().padStart(2, '0');
    const minutes = Math.floor((diff / 60) % 60).toString().padStart(2, '0');
    const hours = Math.floor((diff / 3600) % 24).toString().padStart(2, '0'); // updated to calculate hours correctly
    const days = Math.floor(diff / 86400).toString();

    return `${days !== "0" ? days + "일 " : ""}${hours !== "00" ? hours + ":" : ""}${minutes}:${seconds}`;
}