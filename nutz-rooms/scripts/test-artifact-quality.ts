/**
 * Artifact Quality Test Script
 * Tests 10 realistic conversation scenarios against the artifact generation API
 */

import fs from 'fs/promises';
import path from 'path';

const API_URL = 'http://localhost:3000/api/create-artifact';

interface TestScenario {
  name: string;
  transcript: { role: string; content: string }[];
  context: string;
  intent: string;
}

const scenarios: TestScenario[] = [
  // 1. Overwhelmed - user has too many things going on
  {
    name: '01-overwhelmed',
    context: 'Help me figure out what to focus on',
    intent: 'clarity',
    transcript: [
      { role: 'user', content: "Hey Kagan, I'm feeling super overwhelmed right now" },
      { role: 'assistant', content: "What's on your plate? Just brain dump everything." },
      { role: 'user', content: "Okay so I have my SaaS product that's doing like 2k MRR, then I have this consulting gig that pays the bills, I'm supposed to be launching a course, and my co-founder wants to pivot the main product. Plus I have investor meetings next week." },
      { role: 'assistant', content: "That's a lot. What's actually making money right now and what's speculation?" },
      { role: 'user', content: "The consulting is the only real money - about 8k a month. The SaaS is 2k but growing slowly. The course is just an idea and the pivot is my co-founder's thing." },
      { role: 'assistant', content: "Sounds like you're carrying 5 things equally. Which one would you regret NOT doing if you had to drop everything else?" },
    ],
  },

  // 2. New Idea - workout tracking app for serious lifters
  {
    name: '02-new-idea-fitness-app',
    context: 'Validate my workout tracking app idea',
    intent: 'idea_validation',
    transcript: [
      { role: 'user', content: "I have this idea for a workout tracking app specifically for powerlifters" },
      { role: 'assistant', content: "There are hundreds of workout apps. What's different about yours?" },
      { role: 'user', content: "Most apps are for casual gym-goers. Powerlifters need to track specific things like RPE, percentage of 1RM, and periodization cycles. Strong and the others are too basic." },
      { role: 'assistant', content: "Have you talked to powerlifters about this?" },
      { role: 'user', content: "Yeah I'm in a powerlifting gym and everyone uses spreadsheets or pen and paper because the apps suck. I've talked to maybe 10 people informally." },
      { role: 'assistant', content: "Would any of them pay for this? Have you asked?" },
      { role: 'user', content: "I haven't asked directly but they spend hundreds on belts and equipment so money isn't the issue. I think they'd pay $10-15/month for something that actually works." },
    ],
  },

  // 3. Ready to Build - validated, needs MVP scope
  {
    name: '03-ready-to-build-mvp',
    context: 'Define MVP scope for my scheduling tool',
    intent: 'mvp_scoping',
    transcript: [
      { role: 'user', content: "I've validated demand for my scheduling tool for podcasters. I have 50 people who said they'd pay. Now I need to build it." },
      { role: 'assistant', content: "What did they specifically say they'd pay for? What problem are you solving?" },
      { role: 'user', content: "They hate coordinating with guests across time zones and sending calendar links back and forth. They want one link, guest picks a time, auto-generates zoom, done." },
      { role: 'assistant', content: "Calendly does that. Why wouldn't they just use Calendly?" },
      { role: 'user', content: "Calendly doesn't integrate with podcast workflows. I want to auto-generate prep docs, sync with podcast scheduling tools like Riverside, and auto-send guest questions." },
      { role: 'assistant', content: "That's a lot for an MVP. What's the one feature that would make someone pay you $20/month right now?" },
      { role: 'user', content: "Honestly probably just the timezone-aware scheduling with automatic Riverside room creation. That alone saves them 20 minutes per guest." },
    ],
  },

  // 4. Revenue Model - 100 free users, wants $10k MRR
  {
    name: '04-revenue-model',
    context: 'How do I get to $10k MRR from 100 free users',
    intent: 'revenue_strategy',
    transcript: [
      { role: 'user', content: "I have 100 users on my AI writing tool but they're all free. I want to hit 10k MRR. How do I think about pricing?" },
      { role: 'assistant', content: "How many of those 100 users actually use it regularly? Like weekly?" },
      { role: 'user', content: "Maybe 30 are active weekly. The rest signed up and barely use it." },
      { role: 'assistant', content: "Okay so you have 30 real users. To hit 10k MRR you need either 100 people at $100, 500 at $20, or 1000 at $10. What's realistic?" },
      { role: 'user', content: "I think $29/month is reasonable for the value. So I'd need about 350 paying users. But I don't know how to convert my free users." },
      { role: 'assistant', content: "Have you talked to your 30 active users about what they'd pay for? What feature would unlock their wallet?" },
      { role: 'user', content: "A few mentioned they'd pay for more AI credits and team features. But I haven't done formal pricing research." },
    ],
  },

  // 5. Investor Outreach - $3k MRR, 400 users, raising seed
  {
    name: '05-investor-outreach',
    context: 'Prepare for seed fundraise',
    intent: 'fundraising_prep',
    transcript: [
      { role: 'user', content: "We're doing 3k MRR with 400 users and want to raise a seed round. Where do I even start?" },
      { role: 'assistant', content: "What's your growth rate month over month?" },
      { role: 'user', content: "We've been growing about 20% MoM for the last 4 months" },
      { role: 'assistant', content: "That's solid. 20% MoM means you double every 4 months. How much are you raising and what's your runway now?" },
      { role: 'user', content: "We have 3 months of runway left. I'm thinking $500k at a $5M valuation." },
      { role: 'assistant', content: "With 3 months runway you need to move fast. Have you talked to any investors yet?" },
      { role: 'user', content: "Not yet. I don't know any VCs personally and cold outreach feels weird. I was thinking of using AngelList or something." },
    ],
  },

  // 6. Customer Discovery - PM tool for freelancers, needs to find users
  {
    name: '06-customer-discovery',
    context: 'Find users to interview for my PM tool',
    intent: 'customer_discovery',
    transcript: [
      { role: 'user', content: "I want to build a project management tool specifically for freelance designers. But I'm not a designer and don't know any." },
      { role: 'assistant', content: "Why freelance designers specifically?" },
      { role: 'user', content: "My sister is one and she complains about Asana and Notion being overkill. She just needs simple client project tracking." },
      { role: 'assistant', content: "One person's complaint isn't validation. Have you talked to other freelance designers?" },
      { role: 'user', content: "No, that's my problem. I don't know where to find them or how to approach them without being weird." },
      { role: 'assistant', content: "Where does your sister hang out online with other designers? Twitter? Slack communities? Dribbble?" },
      { role: 'user', content: "She's in a few Discord servers for designers and posts on Twitter sometimes. I could probably ask her to intro me." },
    ],
  },

  // 7. Decision Stuck - quit job vs side project, $30k savings
  {
    name: '07-decision-stuck',
    context: 'Should I quit my job to go full-time on my side project',
    intent: 'decision_making',
    transcript: [
      { role: 'user', content: "I've been going back and forth for months on whether to quit my job and go full-time on my side project" },
      { role: 'assistant', content: "What's the side project and what traction does it have?" },
      { role: 'user', content: "It's a Chrome extension for sales teams that automates LinkedIn outreach. I have 50 users, 5 paying $49/month. So about $250 MRR." },
      { role: 'assistant', content: "How much time do you spend on it now and how much do you think you need?" },
      { role: 'user', content: "I spend maybe 10 hours a week. I think if I went full-time I could 10x the growth. But I also have a good job making $180k." },
      { role: 'assistant', content: "What's your savings situation? How long could you survive without the salary?" },
      { role: 'user', content: "I have about $30k saved. My expenses are like $4k/month so maybe 7-8 months if I'm careful. But that scares me." },
    ],
  },

  // 8. Meeting Prep - apartment viewing in 2 hours, Munich
  {
    name: '08-meeting-prep-apartment',
    context: 'Prepare for apartment viewing in Munich',
    intent: 'meeting_prep',
    transcript: [
      { role: 'user', content: "I have an apartment viewing in 2 hours in Munich and I'm stressed. The rental market here is insane." },
      { role: 'assistant', content: "What makes this one special? And what's your competition like?" },
      { role: 'user', content: "It's in a great location, reasonable price, but there will probably be 20 other people there. I need to stand out somehow." },
      { role: 'assistant', content: "Do you have your documents ready? Schufa, employment contract, salary proof?" },
      { role: 'user', content: "I have most of it but it's a mess of different files. Should I print everything?" },
      { role: 'assistant', content: "Print it. Put it in a nice folder. Make it easy for the landlord to say yes to you. What else can you bring?" },
      { role: 'user', content: "I didn't think about that. Should I bring a cover letter or something?" },
    ],
  },

  // 9. Pitch Help - investor meeting tomorrow, 500 users
  {
    name: '09-pitch-prep',
    context: 'Prepare pitch for investor meeting tomorrow',
    intent: 'pitch_prep',
    transcript: [
      { role: 'user', content: "I have an investor meeting tomorrow and my pitch is all over the place" },
      { role: 'assistant', content: "What's the company and what are your numbers?" },
      { role: 'user', content: "We're building AI-powered code review for teams. 500 users, 50 paying, $2500 MRR, growing 15% month over month." },
      { role: 'assistant', content: "That's decent traction. What's the ask?" },
      { role: 'user', content: "We want $750k pre-seed to hire 2 engineers and go full-time. Currently we're all part-time." },
      { role: 'assistant', content: "What's your story? Why are YOU the team to build this?" },
      { role: 'user', content: "We all worked at Google and dealt with painful code review at scale. I was tech lead on a team of 40." },
    ],
  },

  // 10. Landing Page - test demand before building
  {
    name: '10-landing-page-demand-test',
    context: 'Create landing page to test demand before building',
    intent: 'demand_validation',
    transcript: [
      { role: 'user', content: "I want to test if there's demand for my idea before building anything. Should I do a landing page?" },
      { role: 'assistant', content: "What's the idea?" },
      { role: 'user', content: "A tool that automatically generates social media content from your blog posts. You paste a blog URL and it gives you 10 tweets, LinkedIn posts, etc." },
      { role: 'assistant', content: "Who's the target customer? Bloggers? Content marketers? Solopreneurs?" },
      { role: 'user', content: "I was thinking solopreneurs and small marketing teams who write blogs but don't have time to repurpose content." },
      { role: 'assistant', content: "Good. A landing page is the right move. What would make someone give you their email?" },
      { role: 'user', content: "I was thinking early access to the tool plus maybe a free trial of 5 blog posts. But I'm not sure what to write on the page." },
    ],
  },
];

async function testScenario(scenario: TestScenario): Promise<{ name: string; elapsed: number; success: boolean; content?: string; error?: string }> {
  const startTime = Date.now();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: scenario.context,
        intent: scenario.intent,
        transcript: scenario.transcript,
      }),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      return { name: scenario.name, elapsed, success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    return {
      name: scenario.name,
      elapsed,
      success: true,
      content: data.content,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    return {
      name: scenario.name,
      elapsed,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log('🧪 Artifact Quality Test Suite\n');
  console.log('=' .repeat(60));

  const outputDir = path.join(process.cwd(), 'test-outputs');
  await fs.mkdir(outputDir, { recursive: true });

  const results: { name: string; elapsed: number; success: boolean; error?: string }[] = [];

  for (const scenario of scenarios) {
    console.log(`\n📋 Testing: ${scenario.name}`);
    console.log(`   Context: "${scenario.context}"`);

    const result = await testScenario(scenario);
    results.push({ name: result.name, elapsed: result.elapsed, success: result.success, error: result.error });

    if (result.success && result.content) {
      // Save to file
      const filename = path.join(outputDir, `${scenario.name}.md`);
      await fs.writeFile(filename, result.content);
      console.log(`   ✅ Generated in ${result.elapsed}ms (${result.content.length} chars)`);
      console.log(`   📁 Saved to: ${filename}`);
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
    }
  }

  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 SUMMARY\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total: ${results.length} scenarios`);
  console.log(`✅ Passed: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (successful.length > 0) {
    const avgTime = Math.round(successful.reduce((sum, r) => sum + r.elapsed, 0) / successful.length);
    const maxTime = Math.max(...successful.map(r => r.elapsed));
    const minTime = Math.min(...successful.map(r => r.elapsed));

    console.log(`\n⏱️  Timing:`);
    console.log(`   Avg: ${avgTime}ms`);
    console.log(`   Min: ${minTime}ms`);
    console.log(`   Max: ${maxTime}ms`);
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed scenarios:');
    failed.forEach(f => console.log(`   - ${f.name}: ${f.error}`));
  }

  console.log('\n📁 Artifacts saved to: test-outputs/');
  console.log('\nNext: Review each artifact against the quality bar:\n');
  console.log('  □ Personal (uses their specific words)');
  console.log('  □ Opinionated (takes a stance)');
  console.log('  □ Prioritized (ONE THING first)');
  console.log('  □ Actionable (has checkboxes, specific actions)');
  console.log('  □ Right-sized');
  console.log('  □ Tight deadline');
  console.log('  □ Math included (where relevant)');
  console.log("  □ Kagan's voice");
  console.log('  □ No fluff');
  console.log('  □ Clear next action');
}

main().catch(console.error);
