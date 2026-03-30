export interface QuestionConfig {
  id:
    | "q1_raw"
    | "q2_raw"
    | "q3_raw"
    | "q4a_raw"
    | "q4b_raw"
    | "q5a_raw"
    | "q5b_raw"
    | "q6_raw"
    | "q7_raw"
    | "q8_raw"
    | "q9_raw"
    | "q10_raw";
  title: string;
  prompt: string;
  options: Array<{ label: string; value: string }>;
}

export const QUESTION_CONFIGS: QuestionConfig[] = [
  {
    id: "q1_raw",
    title: "Q1 Sleep Schedule",
    prompt: "On most regular weekdays, when do you usually go to sleep?",
    options: [
      { label: "Before 11 PM (early)", value: "Before 11 PM (early)" },
      { label: "11 PM - 1 AM (normal)", value: "11 PM - 1 AM (normal)" },
      { label: "1 AM - 3 AM (late)", value: "1 AM - 3 AM (late)" },
      { label: "After 3 AM (very late)", value: "After 3 AM (very late)" },
    ],
  },
  {
    id: "q2_raw",
    title: "Q2 Cleanliness",
    prompt: "Which best describes how you keep your side of the room?",
    options: [
      {
        label: "Very tidy - I like things clean and organized",
        value: "Very tidy - I like things clean and organized",
      },
      {
        label: "Tidy - I clean up a few times a week",
        value: "Tidy - I clean up a few times a week",
      },
      {
        label: "Relaxed - I clean when it looks messy",
        value: "Relaxed - I clean when it looks messy",
      },
    ],
  },
  {
    id: "q3_raw",
    title: "Q3 Late Return",
    prompt:
      "On most days, by what time are you usually back in your room/hostel?",
    options: [
      { label: "Before 10 PM", value: "Before 10 PM" },
      {
        label: "Between 10 PM and midnight",
        value: "Between 10 PM and midnight",
      },
      { label: "Often after midnight", value: "Often after midnight" },
    ],
  },
  {
    id: "q4a_raw",
    title: "Q4a Room Use Habit",
    prompt: "How do you usually use your room?",
    options: [
      {
        label: "Mainly for sleeping/studying, not for hanging out",
        value: "Mainly for sleeping/studying, not for hanging out",
      },
      {
        label: "Sometimes hang out with friends in the room",
        value: "Sometimes hang out with friends in the room",
      },
      {
        label: "Often a hangout place, friends visit frequently",
        value: "Often a hangout place, friends visit frequently",
      },
    ],
  },
  {
    id: "q4b_raw",
    title: "Q4b Room Use Comfort",
    prompt:
      "How comfortable are you if your roommate often invites friends or uses the room to hang out?",
    options: [
      { label: "Very uncomfortable", value: "Very uncomfortable" },
      {
        label: "Prefer to avoid, but can manage",
        value: "Prefer to avoid, but can manage",
      },
      { label: "Okay if it's occasional", value: "Okay if it's occasional" },
      {
        label: "Fine even if it's frequent",
        value: "Fine even if it's frequent",
      },
    ],
  },
  {
    id: "q5a_raw",
    title: "Q5a Night Activity Habit",
    prompt:
      "After 11 PM, how often do you game, stream, call, or chat in the room?",
    options: [
      { label: "Almost never", value: "Almost never" },
      {
        label: "Sometimes (a few nights a week)",
        value: "Sometimes (a few nights a week)",
      },
      { label: "Frequently (most nights)", value: "Frequently (most nights)" },
    ],
  },
  {
    id: "q5b_raw",
    title: "Q5b Night Activity Comfort",
    prompt:
      "How comfortable are you if your roommate is often active at night (gaming/streaming/calls) in the room?",
    options: [
      { label: "Very uncomfortable", value: "Very uncomfortable" },
      {
        label: "Prefer to avoid, but can manage",
        value: "Prefer to avoid, but can manage",
      },
      { label: "Okay if occasional", value: "Okay if occasional" },
      { label: "Fine even if frequent", value: "Fine even if frequent" },
    ],
  },
  {
    id: "q6_raw",
    title: "Q6 Smoking Preference",
    prompt: "What is your preference about smoking related to your room?",
    options: [
      {
        label: "I need a 100% smoke-free room",
        value: "I need a 100% smoke-free room",
      },
      {
        label:
          "I don't smoke but don't mind if roommates smoke (following hostel rules)",
        value:
          "I don't smoke but don't mind if roommates smoke (following hostel rules)",
      },
      { label: "I am a smoker", value: "I am a smoker" },
    ],
  },
  {
    id: "q7_raw",
    title: "Q7 Alcohol Preference",
    prompt: "What is your preference about alcohol related to your room?",
    options: [
      {
        label: "I require an alcohol-free room",
        value: "I require an alcohol-free room",
      },
      {
        label:
          "I don't drink, but don't mind if roommates store/drink responsibly",
        value:
          "I don't drink, but don't mind if roommates store/drink responsibly",
      },
      {
        label: "I may store or drink (where allowed)",
        value: "I may store or drink (where allowed)",
      },
    ],
  },
  {
    id: "q8_raw",
    title: "Q8 Diet Preference",
    prompt: "What best describes your in-room food preference?",
    options: [
      {
        label: "I am strict vegetarian and require a meat-free room",
        value: "I am strict vegetarian and require a meat-free room",
      },
      {
        label: "I am vegetarian but okay if roommates keep/cook non-veg",
        value: "I am vegetarian but okay if roommates keep/cook non-veg",
      },
      { label: "I am non-vegetarian", value: "I am non-vegetarian" },
    ],
  },
  {
    id: "q9_raw",
    title: "Q9 Shared Budget",
    prompt:
      "What's your approach to shared room expenses (for appliances, Wi-Fi, and comfort add-ons)?",
    options: [
      {
        label: "Budget-conscious - prefer to keep costs low",
        value: "Budget-conscious - prefer to keep costs low",
      },
      {
        label: "Standard - okay with reasonable shared costs",
        value: "Standard - okay with reasonable shared costs",
      },
      {
        label: "Flexible - willing to spend more for extra comfort",
        value: "Flexible - willing to spend more for extra comfort",
      },
    ],
  },
  {
    id: "q10_raw",
    title: "Q10 Lifestyle Tolerance",
    prompt:
      "In general, how comfortable are you living with someone whose lifestyle is different from yours?",
    options: [
      {
        label: "I prefer someone very similar to me",
        value: "I prefer someone very similar to me",
      },
      {
        label: "I can manage some differences",
        value: "I can manage some differences",
      },
      {
        label: "I'm okay with many differences",
        value: "I'm okay with many differences",
      },
      {
        label: "I'm very flexible/open",
        value: "I'm very flexible/open",
      },
    ],
  },
];
