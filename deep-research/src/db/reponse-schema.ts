
const finalschema = {
    serpQueries: [
        {
            query: "Query that was searched on searxng and used to find websites",
            objective: "Very detailed objective of this serp query so that if we get websites, we scrape that and then website analyzer agent can only extract the information that meets this objective.",
            query_rank: 1, // At what order it was called? Was it the first or last serp query? It is alos the identifyer of this query.
            successful_scraped_websites: [
                {
                    url: "https://www.example.com",
                    title: "Title of the website which we get from searxng reponse.",
                    description: "Description of the website which we also get from searxng reponse.",
                    isRelevant: "Website analyzer agent will give absolute score from 1 to 10 based on the relevance of the content in the website to fully met the objective.",
                    extracted_from_website_analyzer_agent: [
                        "most relevent information that was extracted from the website that  met the above objective.",
                        "All the facts and figures and highly relevent information from the website in array of string fomrat.",
                        "...... can be as many but make sure that every information is highly relevant if not don't even include it."
                    ],

                }
            ],
            failedWebsites: ["array of string of websites that were failed to scrape and we also did not invoke website analyzer agent on them. They were also not included for information crunching and report writing."],
        }

    ],
    information_crunching_agent: {
        // We crunch information per serp query. We consider all the relevent websites only above 7 relevance score from website analyzer agent here. And from them we even crunch down the information even more and even decrease the unrelevance information here. Only include the websites that are even more relevant to the objective. And this will be used for report writing.
        serpQueries: [
            {
                query_rank: "Serp query's rank which is also the identifyer of that query.",
                crunched_information: [{
                    url: "https://www.example.com",
                    content: ["Array of string of content that was crunched by the information crunching agent."],
                },
                    // ... Can be as many objects as needed.
                ]

            }
        ]

    },
    report: {
        title: "Report title",
        report_id: 123 - 12312 - 1231 - 23 - 123, //"Unique identifyer for this report",
        sections: [
            {
                rank: "Section rank, at which rank show we show this section? This is also the identifyer of this particular section ok?",
                sectionHeading: "H1 or H2 or H3 but in markdown format with appropriate markdown tags ok? so that it's easy to parse markdown and show in frontend.",
                content: "Content in full markdown format. Include anything that you want list, url citations in [rank number of the website from citedUrls below.](id of url that is below there in citedUrls.) format. And everything thing ok?"
            },
            // .... this can be as many objects as needed.
        ]
        ,
        citedUrls: [
            {
                rank: 1, // Most highly cited url on the report must be 1 ok? And according to the rank have them sequentially. This is alos the unique identifyer of this url.
                url: "https://www.example.com",
                title: "Title of the website.",
                oneValueablePoint: "One valueable infomration, facts or figures that meets our objective and is used to write this report."

            }
        ]


    },

}