import fetch from 'node-fetch'; // wait, node 22 has global fetch

async function run() {
  const res = await fetch("http://localhost:5000/api/v1/user", {
    headers: {
      "x-mock-user": "test_welcome_new_user@example.com"
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
