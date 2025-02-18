// const response = await fetch(
//     `http://localhost:8080/?q=${"elon musk"}&format=json`,
//     { method: "POST" }
// );
// const data = await response.json();
// console.log(data.results);


const response = await fetch('http://host.docker.internal:3002/v1/scrape', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${""}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ formats: ['markdown'], url: "https://docs.agno.com", "onlyMainContent": true, "waitFor": 200, "timeout": 5000, "blockAds": true })

    //   body: '{"formats":["markdown"],"url":"https:docs.agno.com","onlyMainContent":true,"waitFor":700,"timeout":5000,"location":{"country":"\'US\'"}}'
});

const data = await response.json();

console.log(data)




// const options = {
//     method: 'POST',
//     headers: { Authorization: 'Bearer ', 'Content-Type': 'application/json' },
//     body: '{"urls":["https://docs.agno.com"],"prompt":"make it awesome","schema":{"twitter account":"string","property1":"string","property2":23}}'
// };

// const response = await fetch('http://host.docker.internal:3002/v1/extract', options)
//     .then(response => response.json())
//     .then(response => console.log(response))
//     .catch(err => console.error(err));


// const data = await response.json();

// console.log(data)