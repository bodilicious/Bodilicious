const testChat = async () => {
    try {
        const res = await fetch("http://localhost:5000/api/v1/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "I want a serum", history: [] })
        });
        const data = await res.json();
        console.log("Status:", res.status);
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Fetch Error:", err);
    }
};
testChat();
