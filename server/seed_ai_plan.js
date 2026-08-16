const prisma = require('./src/db');

async function main() {
  const users = await prisma.user.findMany();
  if (users.length === 0) {
    console.log("No users found in database.");
    return;
  }
  
  console.log(`Found ${users.length} users. Seeding AI plans...`);
  
  const aiWeeks = [
    {
      weekNumber: 1,
      goalText: "LLM Foundations + Evaluation (the gap most 'RAG builders' have)",
      weekdayTopic: "Transformer architecture fundamentals (attention, embeddings, tokenization) — enough to explain in interviews, not to derive math from scratch. Then: prompt engineering patterns (few-shot, CoT, ReAct), and context window/token economics.",
      weekendTopic: "Build a small RAG evaluation harness — implement retrieval metrics (precision@k, recall) and generation metrics (faithfulness, answer relevance) using a framework like RAGAS. This is a huge interview differentiator — almost nobody at your level talks about evaluating their RAG pipelines, only building them."
    },
    {
      weekNumber: 2,
      goalText: "Agents, Fine-tuning Basics, and Vector DB Internals",
      weekdayTopic: "Go deeper than LangGraph usage — study agent failure modes (hallucinated tool calls, infinite loops, state management), and multi-agent orchestration patterns (supervisor, hierarchical). Also cover basics of fine-tuning: LoRA/QLoRA concepts, when fine-tuning beats RAG, dataset prep for SFT.",
      weekendTopic: "Hands-on: fine-tune a small open-source model (e.g. Llama 3.2 1B/3B or Phi-3) on a small custom dataset using LoRA via Hugging Face + PEFT, on free-tier Colab/Kaggle GPU. Even a toy result is enough — the point is being able to say \"I've fine-tuned a model\" credibly in interviews."
    },
    {
      weekNumber: 3,
      goalText: "Production/System Design + Portfolio Capstone",
      weekdayTopic: "LLM system design topics — caching strategies, streaming responses, cost optimization (model routing/cascading), observability for LLM apps (your OpenTelemetry experience is relevant here — connect it explicitly). Also study common LLM interview questions (hallucination mitigation, RAG vs fine-tuning tradeoffs, guardrails design — you already have real experience here from Mira, just prepare to articulate it crisply).",
      weekendTopic: "Build one polished capstone — ideally something that extends your Mira work into a public portfolio piece (e.g., a mini voice/chat agent with your new eval harness, deployed and on GitHub with a clean README). This becomes your strongest talking point and a live demo link for your resume/LinkedIn outreach."
    }
  ];

  for (const user of users) {
    console.log(`Seeding for user: ${user.email} (${user.name})`);
    
    // Delete existing AI weeks
    await prisma.planWeek.deleteMany({
      where: {
        userId: user.id,
        track: 'AI'
      }
    });

    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    for (const weekData of aiWeeks) {
      const end = new Date(startDate);
      end.setDate(startDate.getDate() + 6);

      const week = await prisma.planWeek.create({
        data: {
          userId: user.id,
          track: 'AI',
          weekNumber: weekData.weekNumber,
          startDate,
          endDate: end,
          goalText: weekData.goalText
        }
      });

      // Create Weekend Plan
      await prisma.planDay.create({
        data: {
          userId: user.id,
          planWeekId: week.id,
          track: 'AI',
          date: startDate,
          dayLabel: 'Weekend Plan',
          isWeekend: true,
          topic: weekData.weekdayTopic,
          discussionNote: '',
          isDone: false
        }
      });

      // Create Weekday Plan
      const monDate = new Date(startDate);
      monDate.setDate(startDate.getDate() + 2); // Monday
      await prisma.planDay.create({
        data: {
          userId: user.id,
          planWeekId: week.id,
          track: 'AI',
          date: monDate,
          dayLabel: 'Weekday Plan',
          isWeekend: false,
          topic: weekData.weekendTopic,
          discussionNote: '',
          isDone: false
        }
      });

      console.log(`Created Week ${weekData.weekNumber} for ${user.email}`);
      
      // Next week starts after this week ends
      startDate = new Date(end);
      startDate.setDate(end.getDate() + 1);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
