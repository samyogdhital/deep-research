// import * as fs from 'fs/promises';
// import { deepResearch, writeFinalReport } from './deep-research';
// import { generateFeedback } from './feedback';
// import { OutputManager } from './output-manager';

// const output = new OutputManager();

// // Helper function for logging
// function log(...args: any[]) {
//   output.log(...args);
// }

// async function run() {
//   try {
//     log("Starting research process...");

//     // 1. Default values for testing
//     const initialQuery = `
// I am interested in space based datacenter. How to build spacebased datacenters. How to deply consumer grade gpus like h100 and gb200 nvl72 racks and all in space. A huge datacenter into space that is highly optimized for distributed AI training with very low latency between 2 furthest gpus, sub millisecond latency. I am interested in what are the major components and how to architecture and design these major systems to make this space based datacenter. How do you envision this space based datacenter in near 1-2 year timeframe? How will they execute first and hwo they will evolve overtime? What will their adoption look like? Particularly how to build this with highly technical detail including even minute thoroughly thought details and architectural choices? What are the given constrains on which we have to work on?


// We are building for multigigawatt scale datacenter. We realized that building multiple 10s of gigawatt scale single datacenter on earth is nearly impossible. So space becomes the only and best option for this. There is no space limit. You can build in 3d right? If you have right architectural design for this datacenter, you can have comptue racks filled containers above below, left right, 360 degree which is impossible on earth. Here we only expand datacenter left to right(horizontally). So I am thinking of having huge solar panels for the energy generation cause it is abondance in space. I mean I am not sure abotu total mass limit of datacenter. We want to build gigawatt scale datacnter but having said that we want to reduce the overall weight. Casue that equates to more /kg payload cost to lauch into space.



// sub milisecond latency between two GPUs. Latency and bandwidth is the main factor. we don't have to optimize for power consumption cause we just can deploy more solar panels in space. Since we'll be training ai models so our data center will be highly optimized for doing huge trillion plus parameter models not only that if you see the robotics the robotics industry is booming as well and recently we come to the point where we are somewhat doing good with language model and the traditional data centers the gpu's that we have served well up until now but if you see robotics it requires different set of different breed of data set right it needs real world data set it needs the different scale of data set that is beyond the data set we used to train a simple language model or a sophisticated language model so you can imagine the compute that we need to build autonomous robots so for that what we need is we are building this highly distributed sub millisecond latency highly capable data center in a space and that is why we want to build it because the energy generation energy requirement is so high on Earth you cannot you can't build this scale of data center or N you cannot do that so that is why I am particularly interested in space . Yeah so when you are talking about the connection between two gpus what I see that you mentioned this free space optical interconnect right and I did some research around it and come to the conclusion that I may be wrong but I come to the conclusion that this space is miniscule compared to the speed that current fiber optics can give right so obviously there will be some involvement of fiber optics in our data center obviously because it is the fastest way to transfer data the fastest way to transfer data between two gpus with minimal latency possible so that is what we are looking for around connecting different gpus in a in a single cluster but again the problem is that we are trying to minimize mechanical lattice and connection points and things like that like if you have to connect imagine you have to connect are there 45 cable rgb port it's kind of like a mechanical task right you can't do it autonomously you have to slightly push it inside the port and here that sudden click and then let go the force because at that point the connection is already made so these kind of intricate connections is literally hard to make in space when you are trying to seep things in a modular way and try to connect it together in space because we don't have a space labor we don't have space robots at least not yet we cannot do these kind of mechanical connections so we need to avoid this and so relying on fiber optics while still minimizing the mechanical connection part is highly challenging so these are the things I am particularly interested so that is why I have saying that I am highly interested in technical implementation of how to build this data center in space.


// It's amazing that you're asking the right set up questions so yeah deployment strategy is one of the important thing that I'm considering and I'm actively looking for the best architectural solution here as well the best engineering solution here as well but broadly I will tell you what are the constraints and what I'm thinking and beyond that I'll let you analyze my thought process and then find other the best solution that is beyond my imagination so for that you will have to do thorough research and you already know that that's why we are doing this let me tell you some of the constraint that we have and how we are planning to do things so the biggest constraint that we have here on Earth is not on earth but if you have to deploy this data center in a space imagine like 5 gigahertz data center is literally to use if it is a single data center then it will literally be the size of a small city or things like that so it is a huge data center and we can't see that at once we don't have that size rocket yet and nor it will ever be because that is simply not possible with the amount of resource that we have on Earth so we will have to see things in a modular way and obviously the important constraint that we have is starship de rocket by spacex and the payload module of this rocket is the ultimate constraint that we have so whatever we will be deploying at a time needs to be inside and it needs to be occupying least amount of space S that we are highly utilizing the payload model but when it reaches into space it unfolds or performs some kind of on role strategy to become bigger to be bigger object with expanding surface area so it is similar for the deployment studies kind of similar for solar panel as well as radiators because these things require surface area and while seeping through stars seep you know to minimize the surface area of these things so either we will have to use G fold or on roll kind of stuff to make it possible so this is how we do for for solar panel and radiator but obviously to do a full set above this data center because we will be sending bounds of these in a container and every container will have multiple of these racks so every container in itself is a cluster and we will seep these containers overtime three starship and they will go from starship drop of location to orbiting the earth to the desired location that is sun synchronous orbit where they will get attached with itself they will get expanded through G fold method or on role method or submit bands method so this is what deep root strategy looks like obviously I think we will have to have strategic robotic arm in certain places to make this deployment and connection part easier thus making us easier to ship things into space and and they sift things get connected with each other forming a huge single data center so that is what I am focusing right now so cooling system and instructor design obviously has impact on like the deployment strategy obviously has impact on cooling system and structural design and vice versa so for cooling I have already said we are relying on radiative based cooling so we will be seeping radiators there will be occupying when launched they will be occupying list of outer space and in when they are finally in orbital expand to their fullest size so we will be using radiative based cooling and since we will have since we will have racks inside the container they will be generating a lot of heat so this heat needs to be managed efficiently within the rack there will be liquid cooling system either it is cooling or it is liquid cooling system so liquid cooling will happen inside the rack and this liquid will be flowing throughout this data center kind of forming like a closed loop liquid cooling system so these liquid hot liquid from the cheap will go towards the radiator and radiator will radiate out the heat and thus making the liquid cool and this cooled liquid will again come back to the racks forming this closed loop system and this is what we are trying to do and since I have already told you we are trying to minimize mechanical latches and connection point how do we make sure that D is data center isolated data center full of data center is a data center right clustered data center so we will see multiple of this so that means they will be join they will be joined with each other so our these small our these container data center connected with each other and the liquid cooling system happens efficiently how do you make sure that there is no any leakage and how do even connected and not only that I want even talked about networking net networking is also a biggest challenge like how do you connect this data center in spanning architecture where every time you see another container you know to make connection with existing already a placed container so that is the challenge right how do you form new connection on already deployed data centers so since there is no any space labor available we cannot at least make that possible right now but once robots will be available in space then it will be awesome so currently without relying on robot how do you architect or design and so that's why I'm talking about a universal port where this data center will connect to a centralized long stick like architecture so these data centers will connect in a point in 3D space left right top bottom data center will connect in in one point and then certain distance apart from that there will be radiators connected in every direction right radiating heat in every direction then distance from there there will be solar panel so this stick kind of structure where imagine in 3DS stick kind of strokes are where we have containers connecting on top bottom left right and and radiate results also connecting in that same format and solar panels are also connected in that format and the connection the closed loop connection for this entire data center is running through this is fine architecture this stick like architecture and networking is also happening through this and cooling red power management power providing that they provide so the power generated through solar panel that needs to reach to the data center will flow through this cystic architecture so this architecture will have important task right and that is why you need to connect spinal architecture with this container data center so there is some kind of universal port you need to have where you are minimizing mechanical connection and literally connecting literally you are able to build a system where once you see another container through a starship it efficiently and you portlessly connecting with the existing data center in spine architecture right so these are the things I am interested in I need to do high top notch engineer engineering solution I need around this so that's why I'm trying to do thorough research through your deep researching ability. Let me add this like since we are since Starship will drop the container just in the drop of location that starts up will choose from that drop up location to the data center place where it needs to be this this PLOD data center payload needs to move by itself and for that it needs a propulsion it needs to have its own kind of propulsion system so which propulsion system is best for this and not just the individual data center but these spine architecture is a hole also needs to have its own propulsion system such that if debris is come towards it at bullet speed then it is able to do maneuver by going up in the orbital coming down in the orbit so we need to make sure this works as well so you can see the level of engineering we need to have to make this thing successful and I am highly excited and I am looking towards you to to thorough research and then come up with best architects are highly detailed small to high level detail detailed architectural implementation research then that would be awesome . Earthquake note um you can refer to axiom space past space that are building interest specification commercial interest space station and some coding as satellite technologies and so if you are able to take inspiration from there and and see the application in our task where it is like the reference that you are taking is also the major problem in our architecture as well then I want you to consider that as well so you are free to do whatever you can but ultimately you need to make sure that whatever you explore whatever you see is you are using a reasoning ability and understanding they requirement that we have the set of constraint and the requirement that we have to build this data center in space .



// Yeah so we need to make sure that the reacts inside it are heavily radiation seated because that's the worst thing that you want to do imagine spending hundreds of millions of dollars to build this data center and then you realize that every GPU is that you deployed are suffered by radiation and no longer operational so that's the worst thing that can ever happen so we don't want that we need to heavily seal this while reducing the loans cost per kg so we need to do that and power consumption wise obviously the data center needs to be power efficient but the power efficiency is not a problem since on Earth power is the major constraint that's why we are moving into space generating energy through Sun's capacity since we have infinite solar energy through space through in space through sun right so that's not a huge problem.



// Yeah redundancy and fault tolerance is also the major thing that we need to handle because since we will for a while we will not have access to any space labor so we'll have to rely on everything that we deploy with full backup solution right so it is highly important and we need to design that as well so the networking infrastructure needs to be highly redundant the energy infrastructure needs to be highly returned and propulsion system needs to be highly redundant radiators needs to be highly redundant the cooling system needs to be highly redundant everything needs to be highly redundant here because we can't do any surbacing so we'll have to do that but while while while while minimizing the cost we can at everything at every level the cost is also they most important thing we do optimize for the cost and again like if say certain racks fell they literally fail right what we need to do is the data center needs to gradually debate the load like says we are training a huge AI model and certainly some containers go down literally the native architecture becomes a problem where power generation becomes power connection transmission becomes the problem by which the result is some containers went down now what do you do so when you design our systems such that the load is gracefully reduced it's not sudden interruption and the model that we are training is literally stopped so not that gradual maintaining of the load if some critical components becomes a failure so we need to think from that perspective as well. So you can imagine the intricacies of the things that we are dealing with and that's why what we are doing here is we are trying to come up with a highly highly fault tolerant highly feasible highly perfect architectural design and engineering design engineering systems and process to make this data center in space reality within a 1 and one to two years so currently the agent of these researches we are coming up with everything researching on every small to medium to very high level architecture design choices and things that we can do to make the best architecture spaced space based data center for a given set of constraint that we currently have where the constraint is launched cost is high at least right now starship is not cracked yet so and we do not have access to cheap labor in space we cannot even see per hopeart in space that to the maintenance of data center so having highly fault tolerant highly radiation shielded highly maneuverable from debris mitigation point of view high energy generating high high distributed training with **** millisecond latency between any two farthest gpus and everything so this is what I'm trying to build and so let me add a quick note our life is spent that we are expecting a designing our system is it minimum 15 years that is what we are targeting this data center for obviously if robotics becomes accessible in space then we will optimize things we will do any space servicing and things like that to make our data center best but we have certain constraint right now but we need to play with that because the demand is so high the demand for doing air training is so high that any data center on Earth is not able to fulfill that and every cloud provider hyperscaler are actually fearful deep down that they that will they ever be able to match the scale that the customers are demanding from them and so that is the problem that that is exactly that we are trying to solve through space space data center .`;
//     const breadth = 2;
//     const depth = 2;

//     log("Generating follow-up questions...");

//     // 2. Generate follow-up questions
//     // const followUpQuestions = await generateFeedback({
//     //   query: initialQuery,
//     //   numQuestions: 1,
//     // }).catch(error => {
//     //   log("Error generating feedback:", error);
//     //   throw error;
//     // });

//     // // 3. Hardcoded answers for testing
//     // const questionAnswers = followUpQuestions.map(q => ({
//     //   question: q,
//     //   answer: "Sample answer for testing" // In production, get from user input
//     // }));

//     // 4. Combine for context
//     const fullResearchContext = `
// Initial Query: ${initialQuery}`

//     // Follow-up Questions and Answers:
//     // ${questionAnswers.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}
//     // `;

//     // 5. Start research
//     // Still use onProgress for logging purposes
//     const result = await deepResearch({
//       query_to_find_websites: fullResearchContext,
//       breadth,
//       depth,
//       onProgress: (progress) => {
//         output.updateProgress(progress);
//       },
//     });

//     // 6. Generate final report
//     const report = await writeFinalReport({
//       prompt: fullResearchContext,
//       learnings: result.learnings,
//       visitedUrls: result.visitedUrls
//     });

//     log("Generated Report", report)

//     // Save outputs
//     await fs.writeFile('output.md', report);
//     await fs.writeFile('sources.json', JSON.stringify(
//       result.learnings.map(l => ({
//         learning: l.content,
//         source: l.sourceUrl,
//         quote: l.sourceText
//       })),
//       null,
//       2
//     ));

//     // Save debug logs
//     await output.saveLogs();

//     log('Complete! Check:');
//     log('- output.md for the final report');
//     log('- sources.json for source mappings');
//     log('- research_debug.log for detailed logs');
//   } catch (error) {
//     log("Fatal error in research process:", error);
//     // Write error to log file before exiting
//     await output.saveLogs('error.log').catch(console.error);
//     throw error;
//   }
// }

// // Add more detailed error handling to the main execution
// run().catch(error => {
//   console.error("Application error:", error);
//   output.log("Application failed:", error);
//   output.saveLogs('error.log').finally(() => {
//     process.exit(1);
//   });
// });

// /* PRODUCTION VERSION (uncomment when ready for user input)
// async function run() {
//   // Get user input via API/frontend
//   const initialQuery = await getUserQuery();
//   const breadth = await getResearchBreadth();
//   const depth = await getResearchDepth();

//   // Generate and get answers to follow-up questions
//   const followUpQuestions = await generateFeedback({...});
//   const questionAnswers = await getQuestionAnswers(followUpQuestions);

//   // Rest of the research process
//   ...
// }
// */