import type { RequiredDataFromCollectionSlug } from 'payload'
import { enrichFaithfulIndividualCopy } from './faithful-individual-copy'

// Initial authoring data only. Runtime course pages read Payload.
const originalFaithfulWithMoneyCourse = {
  "title": "Faithful with Money",
  "slug": "faithful-with-money",
  "summary": "Three evenings to read the Bible, talk honestly, and make a plan for your money.",
  "allowSolo": true,
  "allowGroup": true,
  "enrolmentOpen": true,
  "_status": "draft",
  "lessons": [
    {
      "lessonId": "s1",
      "title": "Whose money is it?",
      "required": true,
      "blocks": [
        {
          "id": "s1-block-001",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Three evenings to read, talk, make a plan, and pray. Allow about 85–100 minutes each. You can study alone or with a group. Take turns reading aloud when together.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Your answers save to your account. Personal answers stay private; Shared answers are visible to your course group. Sharing money figures is always optional.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-002",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Before you begin",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-003",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Make a drink and settle in. Read aloud together, or quietly on your own. This takes about 85 minutes.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-004",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "What’s said here stays here.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-005",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Nobody shares a number unless they choose to.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-006",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Talk about your own steps, not the other person’s faults.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-007",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "No shame. Debt, mess and fog are why you’re here.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-008",
          "blockType": "courseQuestion",
          "prompt": "What’s the first thing you remember buying with your own money?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s1-block-009",
          "blockType": "courseQuestion",
          "prompt": "Growing up, was money talked about at home, fought about, or never mentioned?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s1-block-010",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Pray",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Pray briefly. Ask God to make you honest with him and with each other.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-011",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Whose money is it?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-012",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Here’s a question that sounds too easy to bother asking. Whose money is it?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "We all know the Sunday-school answer. But listen to how we actually talk. My pay. My savings. My house. Or, this being Auckland, my house one day, possibly, if a miracle occurs. I earned it. I worked for it. Nobody handed it to me.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "And fair enough. We did get out of bed. But the Bible keeps poking at the question underneath that one. Who gave us the body that got out of bed? The brain that learned the job? The country we were born in or brought to? The teacher who didn’t give up on us? The job that happened to open up that particular week?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Moses saw us coming",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "In Deuteronomy 8, Moses warns Israel about a very specific moment. We’ll settle in. We’ll build nice houses. The bank balance will grow. And we’ll say in our hearts: my strength got me this.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Remember the Lord, he says. He’s the one who gives you the power to make wealth in the first place.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Psalm 24 says it in one line. The earth is the Lord’s, and everything in it. Not most of it. Not the religious bits. Everything. Including whatever is in our account right now.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "The most generous day of David’s life",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Near the end of his life, King David watches Israel give a staggering amount for the temple. Tonnes of gold. Tonnes of silver. If ever a group of people had earned a quiet moment of feeling pleased with themselves, it was this lot.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "And David stands up and prays: who am I, and who are my people, that we should be able to give like this? Everything comes from you. We’ve only given you what came from your own hand.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "On the most generous day of his life, David says: Lord, we’ve just handed you back your own stuff.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "So we’re managers",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Randy Alcorn puts it in a line that’s hard to improve. God owns everything. I’m his money manager.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "That flips the question. If the money’s mine, the question is: how much of my money should I give to God? And that question always produces the same feeling. Reluctance. It’s mine, and now somebody wants some.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "But if it’s his, the question becomes: how much of God’s money should we keep? What does the Owner want done with what he’s put in our hands?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Picture someone running a café for an owner who lives overseas. She has real authority. She makes a hundred decisions a day. She gets paid from the business, and paid well. But she never confuses the till with her wallet. And one day the owner flies home, orders a flat white, and asks one simple question. So. What did you do with what I gave you?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Jesus told that story more than once.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Three bits of good news about owning nothing",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "It’s a relief. If it’s all ours, it’s all on us. Every bill, every rate rise, every what-if at two in the morning. But if we’re managing for a Father who owns the cattle on a thousand hills, we can work hard, plan carefully, and then actually sleep. The Owner hasn’t gone broke.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "It’s a dignity. God could do his work without our wages. He’s chosen not to. He hands real resources to ordinary people in Auckland and says: I trust you with this. Feed your family. Enjoy it. And put it to work for things that will last for ever.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "It’s an account. Managers answer for what they managed. Not to earn God’s love. If we belong to Jesus, that was settled at the cross. But love takes what it’s been trusted with seriously.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "The swap",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "So here’s the swap for the next three sessions. We stop asking, can we afford it? We start asking, is this what the Owner wants done with his money?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Ask it about giving. Ask it about groceries, and the streaming subscriptions, and the holiday. Not grimly. Jesus is a far better boss than money will ever be.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Now open Luke 12 and meet a man who got this spectacularly wrong.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-013",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "The rich fool and the anxious disciple",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-014",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Read each passage aloud, then take the questions one at a time. Talk first. Open “A way in” only when you’ve had a go.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-015",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Read Luke 12:13–21",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-016",
          "blockType": "courseQuestion",
          "prompt": "What prompts the parable, and what warning does Jesus give before he tells it?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "A man wants Jesus to settle an inheritance dispute. Jesus refuses the role and goes to the heart: watch out, be on guard against all greed, because life is not made up of possessions. He says “watch out” because greed doesn’t announce itself. You have to look for it."
        },
        {
          "id": "s1-block-017",
          "blockType": "courseQuestion",
          "prompt": "Count the words “I” and “my” in verses 17–19. What does that tell you about how the man sees his wealth?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "My crops, my barns, my grain, my goods, myself. He talks only to himself. God, neighbours and the poor never enter the conversation. Notice verse 16 too: the land produced the crop. The surplus was a gift before he did anything."
        },
        {
          "id": "s1-block-018",
          "blockType": "courseQuestion",
          "prompt": "The man isn’t dishonest or lazy. He plans, saves and retires early. So why does God call him a fool?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "He planned for every future except the certain one. That night his life is required, and everything he prepared goes to someone else. Jesus’ own verdict is in verse 21: he stored up treasure for himself and was not rich toward God. The sin isn’t the barns. It’s an owner’s mindset with a manager’s assets. Jesus isn’t against saving; session 3 gets to that."
        },
        {
          "id": "s1-block-019",
          "blockType": "courseQuestion",
          "prompt": "What would “rich toward God” have looked like for this man the morning after the harvest?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Picture it concretely. Thanking God. Asking who is short this year. Giving first. Keeping enough, and building only what he needed. That’s this whole course in miniature."
        },
        {
          "id": "s1-block-020",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Read Luke 12:22–34",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-021",
          "blockType": "courseQuestion",
          "prompt": "Jesus turns from the rich man to his disciples, and from greed to worry. How are the two related?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "They’re the same root in two soils. Greed is what trusting money looks like when you have plenty. Worry is what trusting money looks like when you don’t. Both treat money as the thing that will keep me safe. So a tight budget doesn’t mean this passage is for someone else."
        },
        {
          "id": "s1-block-022",
          "blockType": "courseQuestion",
          "prompt": "What reasons does Jesus give not to be anxious? Which do you find hardest to believe on a bad week?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Life is more than food. God feeds the ravens and you’re worth more. Worry adds nothing. He clothes the grass. Your Father knows what you need. And the high point, verse 32: your Father delights to give you the kingdom. Be honest with each other here. Rent and groceries in Auckland are real."
        },
        {
          "id": "s1-block-023",
          "blockType": "courseQuestion",
          "prompt": "“Where your treasure is, there your heart will be also.” Where have you seen your heart follow your money?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "We usually think money follows the heart. Jesus says it runs the other way too. People care about the one company they hold shares in, or the suburb where they own. Put treasure somewhere and your heart moves in after it. So you don’t wait to feel generous before you give."
        },
        {
          "id": "s1-block-024",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Read 1 Timothy 6:6–10 and 17–19",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-025",
          "blockType": "courseQuestion",
          "prompt": "Paul writes to those who want to get rich, and to those who already are. What does he say to each? Which are you?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "To the first: wanting it is a trap that has drowned people, and contentment with food and clothing is great gain. To the second: don’t be arrogant, don’t set your hope on wealth, enjoy what God provides, be rich in good works and ready to share. By any global or historical measure most New Zealanders are in the second group, and feel like they’re in neither."
        },
        {
          "id": "s1-block-026",
          "blockType": "courseQuestion",
          "prompt": "Each of you, finish this sentence: “The place money has the most grip on me is …”",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Take two minutes of quiet before you answer. Nobody has to say theirs aloud. If you do, the other person’s only job is to listen."
        },
        {
          "id": "s1-block-027",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "A terrible master",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-028",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Jesus said something about money that we’ve heard so often we’ve stopped hearing it. No one can serve two masters. You cannot serve God and money.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Notice he doesn’t say we shouldn’t. He says we can’t. And notice the word he picks. Jesus could have called money a temptation, or a distraction. He calls it a master. A rival boss. Something that gives orders.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "And it does. Money tells people which city to live in. It tells them how many hours to work and how often they’ll see their kids. It tells them who to envy and who to look down on. It decides whether they sleep. That’s not a tool. That’s management.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "The sin nobody has",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Tim Keller made a striking observation. Across decades as a pastor, people came to him to confess almost every sin going. Hardly anyone ever came to confess greed. His conclusion: greed hides. It hides best from the person who has it.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "How? We compare up. There’s always somebody with a nicer kitchen, so we can’t be the rich ones. We’re just getting by. We’re just being responsible. Meanwhile Jesus is saying: watch out. Be on your guard.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Four tests",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "These are for the person reading, not the person sitting next to them. No elbowing.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "One. What do we daydream about? When the mind is idling at the lights, where does it drift? The renovation? The number we need before we can finally relax?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Two. What makes us anxious out of all proportion? A surprise bill annoys everyone. But if a few hundred dollars can wreck the week, money is holding more of us than it should.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Three. What can’t we give away? Is there an amount that would actually hurt to part with? That’s the border of money’s territory in us.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Four. What does the bank statement say we love? Not what we’d say we love. What the statement says. It’s the most honest document any of us owns, and it’s this week’s homework.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "We can’t just tell our hearts off",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "If all we did now was resolve to love money less, we’d have a burden and no help. Nobody empties a heart by scolding it. Something better has to push money out.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Here’s Hebrews 13. Keep your life free from the love of money. Be content with what you have. Why? Because God himself has said: I will never leave you or abandon you.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "That’s the logic of Christian contentment. Not: want less, try harder. It’s: we already have him.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "We cling to money because we think it’s the thing standing between us and disaster. And God says: no, that’s me. I’m what stands between you and disaster. And I’m not going anywhere.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "How we know he means it",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "The Son of God had everything, and let go of it. He was rich, Paul says, and for our sake he became poor. He was stripped of everything on a cross, so that people like us, who’ve loved his gifts more than him, could be forgiven and brought home.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "If he gave himself, he’s not going to turn stingy over our daily bread.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Contentment is learned",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Paul says he learned the secret of being content, with plenty or with little. Learned. It didn’t come naturally to an apostle either, which is oddly comforting.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "And the practices aren’t complicated. Thank God for what’s in the fridge. Give first, before we see what’s left. Tell someone the truth about our money. And make a plan, so that money takes orders instead of giving them.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "That’s the rest of this course. Not a way to get rich. A way to get free.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Next up: writing down your money story. Be honest. Nobody has to read it but you and God, and he’s already seen the statement.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-029",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Your money story",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-030",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Fifteen minutes each on your own, then ten together. If you are studying with others, share only what you choose to say aloud; your written answers are personal.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-031",
          "blockType": "courseQuestion",
          "prompt": "What did my family teach me about money, in words or by example?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s1-block-032",
          "blockType": "courseQuestion",
          "prompt": "Am I by nature a spender or a saver? What do I fear?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s1-block-033",
          "blockType": "courseQuestion",
          "prompt": "What’s my first feeling when I think about our finances: calm, dread, guilt, pride, fog?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s1-block-034",
          "blockType": "courseQuestion",
          "prompt": "Where did the four tests land: daydream, anxiety, can’t give away, bank statement?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s1-block-035",
          "blockType": "courseQuestion",
          "prompt": "If the Owner looked over my last month of spending, what would please him? What would I want to explain?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s1-block-036",
          "blockType": "courseQuestion",
          "prompt": "What do I already do well with money that I can thank God for?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s1-block-037",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Then, together",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Each share one thing you wrote that surprised you, and one thing you’d like to be different in a year. If you tell very different stories, that’s normal. Spenders and savers marry each other. Say what you fear, not what the other person does wrong.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-038",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Before session 2",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-039",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "A plan built on guesses fails in week two. So before you meet again, find out where the money actually goes.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s1-block-040",
          "blockType": "courseQuestion",
          "prompt": "Before next time",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "checklist",
          "choices": [
            {
              "choiceId": "item-1",
              "label": "Track every dollar for two weeks. Use your banking app’s spending view or the Sorted budgeting tool. Don’t change anything yet. Just watch."
            },
            {
              "choiceId": "item-2",
              "label": "Download your last three months of bank and card statements. Highlight anything you’d forgotten you were paying for."
            },
            {
              "choiceId": "item-3",
              "label": "List every debt: who you owe, how much, the interest rate and the minimum payment. Include buy-now-pay-later and money owed to family."
            }
          ]
        },
        {
          "id": "s1-block-041",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Pray",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Thank God by name for five things he has provided this week. Then pray 1 Chronicles 29:14 back to him in your own words: everything comes from you, and we have given you only what comes from your hand.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        }
      ]
    },
    {
      "lessonId": "s2",
      "title": "The grace of giving",
      "required": true,
      "blocks": [
        {
          "id": "s2-block-001",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Before you begin",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-002",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Have your two weeks of tracking nearby. Nobody will ever ask what you give, tonight or later. This session is between you and God.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-003",
          "blockType": "courseQuestion",
          "prompt": "What did two weeks of tracking show you that you didn’t expect?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s2-block-004",
          "blockType": "courseQuestion",
          "prompt": "What’s the most generous thing anyone has ever done for you? How did it feel?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s2-block-005",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Pray",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Pray briefly. Ask God to show you the generosity of Jesus again.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-006",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Grace makes givers",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-007",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Here’s the strangest fundraising report in the Bible.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Paul is collecting money for Christians in Jerusalem who are going hungry. He writes to the church in Corinth, a wealthy port city, and tells them what happened up north in Macedonia.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Now, the Macedonian churches were poor. Paul’s phrase is “deep poverty”. They were also being persecuted. If we were drawing up a list of people to ask for money, we’d skip them and feel kind for doing it.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "And Paul says: they begged us. They begged for the privilege of joining in. They gave what they could afford, and then more than they could afford. Out of severe trial and deep poverty came overflowing joy and a wealth of generosity.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Poverty, plus trouble, plus joy, equals generosity. No accountant alive would sign off on that sum. So how did it happen?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Something happened to them first",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Paul tells us in his opening line. We want you to know about the grace of God given to the Macedonian churches.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "He doesn’t say: let me tell you about some very impressive people. He says: let me tell you about grace. Something went into them before anything came out of them.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "And a few verses later he says what it was. This is the centre of everything the Bible says about giving, so read it slowly.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "You know the grace of our Lord Jesus Christ: though he was rich, for your sake he became poor, so that by his poverty you might become rich.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Slowly, then",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "He was rich. Think what the Son of God had. The love of the Father, from before time. The worship of heaven. Everything that exists was made through him and belonged to him.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "He became poor. Born in a borrowed feeding trough. Nowhere to lay his head. And at the end, stripped. Soldiers rolled dice for the last thing he owned. He died owning nothing, carrying our sin.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "For your sake. So that we, who had nothing to bring, might become rich. Forgiven. Adopted. Heirs of the world to come.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "What Paul doesn’t do next",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "He doesn’t say: therefore, you owe ten percent. In verse 8 he says: I’m not commanding you. He refuses to. Giving that’s been squeezed out of someone isn’t what he’s after.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "A chapter later he says it outright. Each person should give what they’ve decided in their heart, not reluctantly or under compulsion, for God loves a cheerful giver.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "So let’s be as clear as Paul is. Nobody at Ev is going to pressure anyone to give. If giving feels like a bill, or a guilt trip, or the price of belonging, hear this: that isn’t Christianity. The gospel is free. Jesus paid.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "But grace isn’t nothing",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Grace does things to people. The Macedonians weren’t guilted. They were changed. They’d seen what Jesus gave up for them, and their grip came loose.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "That’s why Paul keeps calling giving a grace, all the way through the chapter. And it’s why he says to the Corinthians, who were good at so many things: you excel in faith, in speech, in knowledge. See that you excel in this grace too.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Generosity is something we can get better at. Like prayer. Like knowing our Bibles. Nobody is born good at it.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Two questions to take into the passage",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Do we know this grace? Not, do we know about it. Has the poverty of Jesus for us actually landed? Because when giving feels impossible, the fix is rarely a better budget. It’s a longer look at the cross.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "And where’s the evidence? Paul says their giving would show their love was real. Grace that’s gone in comes out. If someone read our bank statements, would they find any sign that we’ve been loved like this?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Open 2 Corinthians 8 and read it together.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-008",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "2 Corinthians 8 and 9",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-009",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Read each passage aloud, then take the questions one at a time.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-010",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Read 2 Corinthians 8:1–9",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-011",
          "blockType": "courseQuestion",
          "prompt": "List everything you learn about the Macedonians’ circumstances and about their giving. What’s surprising?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Circumstances: severe trial and deep poverty. Giving: overflowing joy, rich generosity, according to and beyond their ability, on their own initiative, begging for the privilege. The key is the order in verse 5: they gave themselves first to the Lord. The money followed the person."
        },
        {
          "id": "s2-block-012",
          "blockType": "courseQuestion",
          "prompt": "Paul says he isn’t commanding the Corinthians. What does he use instead to move them?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Two things. The example of others, which tests whether their love is genuine. And the grace of Christ in verse 9. Christian giving is drawn out by grace, not driven by rule. A command would have defeated his purpose."
        },
        {
          "id": "s2-block-013",
          "blockType": "courseQuestion",
          "prompt": "Put verse 9 in your own words. How was Jesus rich? How did he become poor? How have you become rich?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Don’t rush this one. Each of you answer all three parts. Philippians 2:6–8 helps. Everything else tonight depends on this verse being more than familiar."
        },
        {
          "id": "s2-block-014",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Read 2 Corinthians 8:10–15",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-015",
          "blockType": "courseQuestion",
          "prompt": "What principle does verse 12 give for how much to give? How does it free someone on a low income, and challenge someone on a high one?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "The gift is acceptable according to what you have, not what you don’t have. Giving is measured by proportion, not amount. A student giving $15 a week and a couple giving $500 may be giving equally. It cuts both ways: as income rises, the same dollar figure becomes a smaller sacrifice."
        },
        {
          "id": "s2-block-016",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Read 2 Corinthians 9:6–15",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-017",
          "blockType": "courseQuestion",
          "prompt": "From verse 7, what are the marks of giving that pleases God?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Decided in the heart, so thought through beforehand. Not reluctant. Not under compulsion. Cheerful. “Decided” and “cheerful” belong together: planned giving isn’t less spiritual than spontaneous giving. It’s how cheerfulness survives a tight week."
        },
        {
          "id": "s2-block-018",
          "blockType": "courseQuestion",
          "prompt": "What does God promise the generous in verses 8–11? What does he not promise?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "He promises enough: all you need, so you can abound in every good work. He promises to enrich you so that you can be generous on every occasion. The purpose of the supply is more generosity. He doesn’t promise wealth, a bigger house or a return on investment. Giving isn’t an investment scheme."
        },
        {
          "id": "s2-block-019",
          "blockType": "courseQuestion",
          "prompt": "Where does the passage finish? Who ends up being thanked?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Needs are met and thanksgiving overflows to God. Paul ends: thanks be to God for his indescribable gift. Giving begins with God’s gift and ends with God’s praise. The giver is in the middle, enjoying it."
        },
        {
          "id": "s2-block-020",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Read 1 Corinthians 16:1–2",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-021",
          "blockType": "courseQuestion",
          "prompt": "What four features of giving can you find in verse 2?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Regular: the first day of every week. Universal: each of you. Planned: set something aside. Proportionate: in keeping with how you prosper. It’s the nearest thing the New Testament has to a giving method, and it looks a lot like an automatic payment."
        },
        {
          "id": "s2-block-022",
          "blockType": "courseQuestion",
          "prompt": "Which of these describes your giving now: spontaneous, planned, proportionate, sacrificial, cheerful, reluctant, non-existent? Which would you like it to be?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "One word each is enough. If the honest word is “non-existent”, that’s the bravest answer you can give, and tonight is a good night to change it."
        },
        {
          "id": "s2-block-023",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "How much, where and how",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-024",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "So grace makes givers. Now for the practical questions, because love is always practical. There are three, and they’re the three everyone’s been wanting to ask since session 1. How much? Where? And how?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "How much?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "People want a number here, and the number they’ve heard is ten percent. The tithe.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "In the Old Testament, God’s people gave a tenth. Actually more than a tenth, once the various tithes and offerings are added up. It supported the Levites who served at the temple, and it fed the poor.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Then we get to the New Testament and something interesting happens. Nobody repeats the percentage. Not Jesus. Not Paul. What we get instead is a set of words. Generously. Sacrificially. In keeping with your income. According to your means, and beyond.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "We could hear that and think: brilliant, pressure’s off. But think it through. Believers before the cross gave ten percent. We live after it. We’ve seen what God gave. Is the fitting response to that … less?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Don Carson warns what happens when Christians fix on a figure. Someone on a high income gives their ten percent and thinks: done, the rest is mine. And they’ve missed the point entirely. Ten percent is a real stretch for one household and pocket change for another.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "So here’s where we land as a church. Ten percent is a good marker. If we’ve never had a target, it’s a fine one. But it’s not a law, and it’s not a ceiling. A long way under it? Don’t freeze. Start somewhere and step up. Already there, and it costs nothing? Keep going.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "King David was once offered a field for free so he could build an altar on it. He turned the offer down. I will not offer the Lord my God offerings that cost me nothing.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "That’s the real question. Not, what’s the number? But, does it cost us anything?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Where?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "The Bible is clearer on this than people expect. Giving starts with the local church.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Paul tells the Galatians: whoever is taught the word should share all good things with the teacher. He tells Timothy that elders who labour at preaching and teaching should be supported, because the worker deserves his wages. He tells the Corinthians that the Lord himself commanded that those who preach the gospel should get their living from the gospel.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "The pattern is simple. God’s people give, so God’s workers are freed up for God’s work. Church is where we’re fed, where our kids hear about Jesus, where our neighbours get to hear the gospel. Jesus promised to build his church. Giving there is backing the one thing he guaranteed.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "First. But never only. The same Paul was eager to remember the poor, and raised money right across the Roman world for believers he’d never met. So after church: gospel workers, mission partners, people in need. Generosity runs in every direction God’s love does.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "How?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Four words.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "First. Proverbs says to honour the Lord with the firstfruits of the harvest. Giving comes off the top, before rent and groceries. If we give God whatever’s left at the end of the month, we already know how much that’ll be.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Regularly. On the first day of every week, says Paul. Match giving to pay. Paid fortnightly? Give fortnightly.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Automatically. Set it up once and let it run. Some of us feel that’s unspiritual. It isn’t. We decided in our hearts, exactly as Paul asks, and then made sure a chaotic week couldn’t undo it.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Reviewed. Once a year, sit down and ask whether our giving has kept pace with what God’s given us.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "One for the New Zealanders",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Eligible donations to approved donee organisations can qualify for a tax credit of one third, with correct receipts and subject to taxable-income limits. For example, $3,000 of eligible donations can qualify for up to $1,000. Payroll giving has already received its tax credit. Some people give that rebate away again. Worth a conversation over the dishes.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Decision time",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "The next step isn’t a vague intention. It’s an amount, a rhythm and a start date. Pray first. Then decide in your heart, and be cheerful about it.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-025",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Your giving decision",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-026",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Pray first, on your own, for five minutes. Then work it out together.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-027",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Four questions to pray through first",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Does this cost us anything? (2 Samuel 24:24)",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Is it in proportion to what God has given us? (1 Corinthians 16:2)",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Is the local church first? (Galatians 6:6)",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Can we give this cheerfully? (2 Corinthians 9:7)",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-028",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "link",
                      "children": [
                        {
                          "type": "text",
                          "text": "Open the giving calculator",
                          "format": 0,
                          "detail": 0,
                          "mode": "normal",
                          "style": "",
                          "version": 1
                        }
                      ],
                      "direction": "ltr",
                      "format": "",
                      "indent": 0,
                      "version": 3,
                      "fields": {
                        "linkType": "custom",
                        "url": "/generosity/calculator",
                        "newTab": false
                      }
                    },
                    {
                      "type": "text",
                      "text": " to explore an amount. Its figures are separate from your course answers.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-029",
          "blockType": "courseQuestion",
          "prompt": "Household income before tax, per year ($)",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "number"
        },
        {
          "id": "s2-block-030",
          "blockType": "courseQuestion",
          "prompt": "To Ev, per week ($)",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "number"
        },
        {
          "id": "s2-block-031",
          "blockType": "courseQuestion",
          "prompt": "Beyond Ev, per week ($)",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "number"
        },
        {
          "id": "s2-block-032",
          "blockType": "courseQuestion",
          "prompt": "Start date (your next payday)",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s2-block-033",
          "blockType": "courseQuestion",
          "prompt": "When we’ll review it",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s2-block-034",
          "blockType": "courseQuestion",
          "prompt": "What we’ll do with the tax credit each April",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s2-block-035",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Eligible donations can qualify for a tax credit of one third, with receipts and subject to taxable-income limits. Not every gift qualifies, and payroll giving is already credited. ",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    },
                    {
                      "type": "link",
                      "children": [
                        {
                          "type": "text",
                          "text": "Check Inland Revenue’s guidance",
                          "format": 0,
                          "detail": 0,
                          "mode": "normal",
                          "style": "",
                          "version": 1
                        }
                      ],
                      "direction": "ltr",
                      "format": "",
                      "indent": 0,
                      "version": 3,
                      "fields": {
                        "linkType": "custom",
                        "url": "https://www.ird.govt.nz/income-tax/income-tax-for-individuals/individual-tax-credits/donation-tax-credits/about-donation-tax-credits",
                        "newTab": true
                      }
                    },
                    {
                      "type": "text",
                      "text": ".",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-036",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Set it up",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "A decision that isn’t set up tonight is usually still just a decision in three months. Set a recurring gift, or an automatic payment in your banking app dated for payday.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "link",
                      "children": [
                        {
                          "type": "text",
                          "text": "Open give.ev.church",
                          "format": 0,
                          "detail": 0,
                          "mode": "normal",
                          "style": "",
                          "version": 1
                        }
                      ],
                      "direction": "ltr",
                      "format": "",
                      "indent": 0,
                      "version": 3,
                      "fields": {
                        "linkType": "custom",
                        "url": "https://give.ev.church",
                        "newTab": true
                      }
                    },
                    {
                      "type": "text",
                      "text": ".",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Giving nothing yet? The win is a start, at any amount. Try it for six weeks, planned and automatic, then look at what it has done to the budget and to you.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "In a tight season or in debt? Proportion still applies, and a small first gift is a real act of faith. Don’t give borrowed money. Session 3 deals with debt.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Still working out what you think about Jesus? This step isn’t asking you for anything. The gospel is free.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-037",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Before session 3",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-038",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Next time you build the whole plan, so bring the numbers.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s2-block-039",
          "blockType": "courseQuestion",
          "prompt": "Before next time",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "checklist",
          "choices": [
            {
              "choiceId": "item-1",
              "label": "Finish two full weeks of tracking, and total it by category."
            },
            {
              "choiceId": "item-2",
              "label": "Have your take-home pay figure and your list of debts ready."
            },
            {
              "choiceId": "item-3",
              "label": "Read Matthew 6:19–34 once, slowly."
            }
          ]
        },
        {
          "id": "s2-block-040",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Pray",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Thank God for his indescribable gift. Then pray one sentence each for the other person.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        }
      ]
    },
    {
      "lessonId": "s3",
      "title": "A plan for your money",
      "required": true,
      "blocks": [
        {
          "id": "s3-block-001",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Before you begin",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-002",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Tonight you finish with a written plan. Allow up to 100 minutes, and have your tracking, your pay and your debts list open.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-003",
          "blockType": "courseQuestion",
          "prompt": "What category of your spending was bigger than you guessed?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s3-block-004",
          "blockType": "courseQuestion",
          "prompt": "What’s one thing you set up after last session?",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text"
        },
        {
          "id": "s3-block-005",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Pray",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Pray briefly. Ask God for wisdom, and for kindness toward each other when the numbers are hard.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-006",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Why a budget is a spiritual tool",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-007",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Let’s admit it up front. The word budget has a branding problem. It sounds like a diet. It sounds like someone saying no, slowly, in a spreadsheet.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "So here’s a better definition. A budget is a plan for telling money where to go, instead of wondering where it went.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "That’s all. And if the last two sessions are true, that God owns it and we manage it, then a budget stops being a chore. It’s where what we believe meets what we actually do. We can say God comes first. The budget is where he either does or doesn’t.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "But isn’t planning a lack of faith?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Some of us get nervous here. Didn’t Jesus say not to worry about tomorrow? Shouldn’t we just trust God to provide?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "The Bible’s answer is that planning and trusting are friends.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Proverbs: the plans of the diligent lead to profit, but the reckless end up poor. Go to the ant, and watch her. No boss standing over her, and she stores up food all summer. Know the condition of your flocks, because wealth doesn’t last for ever. In our terms: know your numbers.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Jesus assumes it. Which of you, wanting to build a tower, doesn’t first sit down and count the cost? He takes it for granted that sensible people do the sums.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Write it in pencil",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "There is a way of planning that forgets God, though, and the Bible names that too.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "James describes people who announce: today or tomorrow we’ll go to this city, spend a year there, do business and make a profit. And James says: you don’t even know what tomorrow holds. You’re a mist. Instead you ought to say: if the Lord wills, we’ll live and do this or that.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "James doesn’t say stop planning. He says change how we hold the plan. Write it in pencil. Make the budget, then put a hand flat on it and say: Lord, if you will.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Barefoot, but heading somewhere else",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Most money books stop short of that. And some of them are very good. Scott Pape’s The Barefoot Investor has got an enormous number of people out of debt, and we’re about to borrow his best idea without shame.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "But notice where a book like that is heading. Security. A buffer, a paid-off home, a comfortable retirement. Control over our own future.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Good gifts. Poor finish line. Jesus told us about a man who crossed exactly that finish line. Bigger barns, years of supplies, feet up. And God said: you fool.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Yoël Frank, a Christian accountant in Western Australia, wrote The Barefoot Disciple to make the contrast. The investor is heading for retirement. The disciple is heading past it, to eternity. So a disciple asks a budget a different question. Not just, how do we get secure? But, how do we live on less than we could, so more is free for what lasts?",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Six things a Christian budget does",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "It starts with giving, not with leftovers.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "It provides, properly and without apology, for the people God has given us. Paul is blunt: anyone who doesn’t provide for their own household has denied the faith.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "It gets us out of debt, because the borrower is slave to the lender, and we already have a master.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "It saves for what’s coming, without pretending savings can save us.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "It leaves room to enjoy things, with thanks. God richly provides us with everything to enjoy. A budget with no joy in it won’t last a month, and it doesn’t look much like the Father who’s behind it.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "And it leaves margin, so that when we meet a need, we can say yes.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Give, provide, pay down, save, enjoy, stay ready.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "See what Proverbs has to say. Then we build the thing.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-008",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Wisdom for the manager",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-009",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "This one moves faster. Split the proverbs between you for the first question.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-010",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Read Proverbs 6:6–11, 21:5, 21:20, 22:7, 22:26–27, 27:23–24, 13:11 and 3:9–10",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-011",
          "blockType": "courseQuestion",
          "prompt": "Take half the proverbs each. What does each one teach about handling money? Say it the way you’d say it to a twelve-year-old.",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "6:6–11: prepare in the good season for the lean one, because nobody will make you. 21:5: steady planning gets somewhere, and get-rich-quick loses money. 21:20: the wise keep some in store. 22:7: debt hands someone else power over your future. 22:26–27: be very slow to guarantee someone else’s debt. 27:23–24: know your numbers. 13:11: wealth gathered little by little grows. 3:9–10: honour God first, from the top."
        },
        {
          "id": "s3-block-012",
          "blockType": "courseQuestion",
          "prompt": "Which of these does your household already do well? Which one stings?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Start with what you do well. You’re almost certainly doing something right, and it’s worth saying out loud."
        },
        {
          "id": "s3-block-013",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Read Proverbs 30:7–9",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-014",
          "blockType": "courseQuestion",
          "prompt": "What two things does Agur ask for, and what danger does he see on each side?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Keep falsehood far from me, and give me neither poverty nor wealth, only the food I need. Too much, and I may deny God. Too little, and I may steal and dishonour his name. It’s the Bible’s own prayer for a budget: enough."
        },
        {
          "id": "s3-block-015",
          "blockType": "courseQuestion",
          "prompt": "What would “enough” be for your household? Have you ever put a figure on it?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Most people never have, so spending rises with every pay rise. The Barefoot Disciple calls this a spending benchmark: decide what your household needs to live well, and treat income above that line as freed up for giving and saving."
        },
        {
          "id": "s3-block-016",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Read 1 Timothy 5:3–8 and Romans 13:6–8",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-017",
          "blockType": "courseQuestion",
          "prompt": "Who are we financially responsible for, according to these passages? How strongly does Paul put it?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Our own household and relatives, especially ageing parents. Failing to provide is worse than unbelief. Then the state: pay the tax you owe. Then every creditor: let no debt remain outstanding. If you send money to family overseas, that’s obedience to 1 Timothy 5 and it belongs in the budget as a named line."
        },
        {
          "id": "s3-block-018",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Read James 4:13–15",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-019",
          "blockType": "courseQuestion",
          "prompt": "What’s wrong with the planners in verse 13? What does a plan made “if the Lord wills” look like in practice?",
          "visibility": "shared",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Nothing is wrong with the plan itself. What’s missing is God, and any sense that life is short. In practice: pray before you budget, hold the plan loosely, review it when things change, and don’t read a setback as God’s absence."
        },
        {
          "id": "s3-block-020",
          "blockType": "courseQuestion",
          "prompt": "Each of you, finish the sentence: “The reason I’ve avoided making a plan for my money is …”",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "text",
          "guidance": "Fear of what I’ll find. Shame about debt. It feels restrictive. We argue. I don’t know how. Each of those is answered by the gospel before it’s answered by a spreadsheet. There is no condemnation for those in Christ Jesus, and that includes people with a messy bank account."
        },
        {
          "id": "s3-block-021",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Give first, then four buckets",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-022",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Right. Time to build it. Anyone who’s read The Barefoot Investor will recognise the shape, because we’ve borrowed his buckets. We’ve changed one thing, and it’s the most important thing. We’ve put a bucket in front of all the others.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "The idea is simple. Pay lands. Before we touch it, it gets split, automatically, into five places. Each has a job. We set it up once, and the money follows the plan whether we’re having a disciplined week or a fish-and-chips week.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Bucket one: Give",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "The amount decided last session. It leaves on payday, before anything else. Firstfruits. As a starting guide we’ve put ten percent of take-home pay here, but use the figure you decided before God. Some of us will be under that and stepping up. Some will be over.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Bucket two: Live",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "The everyday account. Rent or mortgage, power, groceries, petrol, phone, insurance, school costs, money sent to family. The Barefoot guide is about sixty percent of take-home pay.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Now, I live in Auckland too. For plenty of households here, housing alone is forty or fifty percent, and Live comes out nearer seventy. If that’s us, we haven’t failed. We’ve found our constraint, and that’s useful information. Look hard at the big three: housing, transport and food. That’s where the real money is. Nobody ever fixed a budget by cancelling one streaming service.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Bucket three: Fire",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Barefoot calls it the fire extinguisher. It’s for putting out fires. About fifteen percent, and it does three jobs in order.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Job one: a starter buffer. Pape calls it Mojo. Two thousand dollars in a separate savings account, so that a flat tyre or a dentist doesn’t end up on the credit card.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Job two: debt. List the debts from smallest to largest, leaving out the mortgage and the student loan. Pay the minimum on all of them, and throw everything else in this bucket at the smallest. When it’s gone, roll that payment onto the next one. They fall like dominoes. The maths people will say start with the highest interest rate, and they’re not wrong. But most of us need a win, and the small one gives us a win.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Proverbs says the borrower is slave to the lender. Every debt cleared is a little bit of freedom bought back.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Job three, once the debts are gone: grow the buffer to three months of living costs, then aim this bucket at a house deposit or the mortgage.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Bucket four: Smile",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "About five percent. This is for the things we can see coming. Rego and warrant. Christmas, which has been on the 25th of December for some time now and still manages to ambush us. The trip to see family. Add up those yearly costs, divide by fifty-two, put that aside each week, and December stops being an emergency.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Bucket five: Splurge",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "About ten percent. Coffee, takeaways, clothes we don’t strictly need, a night out. This is the bucket Christians feel guilty about, so let’s say it plainly. God richly provides us with everything to enjoy. That’s 1 Timothy 6. Enjoy it, and say thank you.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "One rule. When it’s gone, it’s gone until next payday. That’s what stops enjoyment turning into a master.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "The whole thing in one breath",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Give, Live, Fire, Smile, Splurge. Ten, sixty, fifteen, five, ten. A starting point. Our numbers will be different, and they’ll change.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Two last things",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Automate it. Most New Zealand banks will open extra accounts for free and let us name them. Set the automatic payments for the day after payday. The best budget is one nobody has to remember.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "And draw a line called enough. Decide what the household needs to live well. Then, when a pay rise comes, don’t let Live and Splurge quietly swallow it. Decide now that at least half of every rise goes to Give and Fire. That’s how ordinary people end up extraordinarily generous. They never earned a fortune. They just stopped their lifestyle rising every time their income did.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Your turn. Tracking, pay, debts and giving decision at the ready. Give every dollar a job.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-023",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Build your plan",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-024",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Type your weekly take-home pay, then fill in each bucket until nothing is left over. Fortnightly pay: halve it. Monthly pay: multiply by 12 and divide by 52.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-025",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Give",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Leaves first, on payday. Use the amount you decided in session 2. The guide is 10%; adjust to your circumstances.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-026",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Live",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Everyday costs, as they really are. In Auckland this often runs nearer 70%. The guide is 60%; adjust to your circumstances.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-027",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Fire",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "A $2,000 buffer first, then debts from smallest to largest, then savings. The guide is 15%; adjust to your circumstances.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-028",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Smile",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Costs you can see coming this year, divided by 52. The guide is 5%; adjust to your circumstances.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-029",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Splurge",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Enjoy it with thanks. When it’s gone, it’s gone until next payday. The guide is 10%; adjust to your circumstances.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-030",
          "blockType": "courseBudget",
          "title": "Your weekly budget",
          "instructions": "Weekly amounts in NZ dollars. Your figures are personal; share only what you choose to discuss.",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "categories": [
            {
              "categoryId": "give",
              "label": "Give",
              "startingLines": "Ev Church\nMission partner, sponsored child, people in need"
            },
            {
              "categoryId": "live",
              "label": "Live",
              "startingLines": "Rent or mortgage\nRates, body corporate, house insurance\nPower, gas, water, internet, phone\nGroceries\nTransport\nCar, contents, health and life insurance\nChildren: school, childcare, activities\nMedical, dental, pharmacy\nSupport for parents or family overseas"
            },
            {
              "categoryId": "fire",
              "label": "Fire",
              "startingLines": "Minimum payments on all debts\nExtra on the smallest debt\nBuffer savings\nHouse deposit or extra on the mortgage"
            },
            {
              "categoryId": "smile",
              "label": "Smile",
              "startingLines": "Annual costs divided by 52"
            },
            {
              "categoryId": "splurge",
              "label": "Splurge",
              "startingLines": "Eating out and coffee\nHobbies, clothes, subscriptions\nPocket money each"
            }
          ]
        },
        {
          "id": "s3-block-031",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "When it won’t balance",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Work down this list in order: forgotten subscriptions and fees, Splurge, food, transport, housing, income. Give comes last, not first. If it has to drop for a season, name the amount and the date you’ll review it.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "If the gap is large, the next step is a free financial mentor, not a tighter spreadsheet. See Help below.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-032",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Keep it going",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-033",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "The first budget is always wrong. Its job is to be corrected next month. Pick one step for the next seven days and tell each other which.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-034",
          "blockType": "courseQuestion",
          "prompt": "Keep it going",
          "visibility": "personal",
          "responseMode": "group",
          "required": false,
          "inputType": "checklist",
          "choices": [
            {
              "choiceId": "item-1",
              "label": "Open and name the extra bank accounts."
            },
            {
              "choiceId": "item-2",
              "label": "Set up the automatic payments for the day after payday."
            },
            {
              "choiceId": "item-3",
              "label": "Put the first $2,000 buffer target in a separate savings account."
            },
            {
              "choiceId": "item-4",
              "label": "Ring one provider (power, phone, insurance) and ask for a better rate."
            },
            {
              "choiceId": "item-5",
              "label": "Call MoneyTalks on 0800 345 123, or contact CAP, for free debt help."
            },
            {
              "choiceId": "item-6",
              "label": "Put a monthly money night in the calendar: thirty minutes, same day each month, with food you like."
            }
          ]
        },
        {
          "id": "s3-block-035",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Pray",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Pray Proverbs 30:8–9 and Matthew 6:33 together: give us neither poverty nor riches, and help us seek your kingdom first.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-036",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "Help",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h2"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "link",
                      "children": [
                        {
                          "type": "text",
                          "text": "MoneyTalks",
                          "format": 0,
                          "detail": 0,
                          "mode": "normal",
                          "style": "",
                          "version": 1
                        }
                      ],
                      "direction": "ltr",
                      "format": "",
                      "indent": 0,
                      "version": 3,
                      "fields": {
                        "linkType": "custom",
                        "url": "https://www.moneytalks.co.nz",
                        "newTab": true
                      }
                    },
                    {
                      "type": "text",
                      "text": ": free, confidential financial mentoring. Call 0800 345 123 or text 4029.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "link",
                      "children": [
                        {
                          "type": "text",
                          "text": "Christians Against Poverty",
                          "format": 0,
                          "detail": 0,
                          "mode": "normal",
                          "style": "",
                          "version": 1
                        }
                      ],
                      "direction": "ltr",
                      "format": "",
                      "indent": 0,
                      "version": 3,
                      "fields": {
                        "linkType": "custom",
                        "url": "https://www.capnz.org/get-help/debt-help/",
                        "newTab": true
                      }
                    },
                    {
                      "type": "text",
                      "text": ": free, confidential debt help.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "link",
                      "children": [
                        {
                          "type": "text",
                          "text": "Sorted",
                          "format": 0,
                          "detail": 0,
                          "mode": "normal",
                          "style": "",
                          "version": 1
                        }
                      ],
                      "direction": "ltr",
                      "format": "",
                      "indent": 0,
                      "version": 3,
                      "fields": {
                        "linkType": "custom",
                        "url": "https://sorted.org.nz",
                        "newTab": true
                      }
                    },
                    {
                      "type": "text",
                      "text": ": budgeting and money guides.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "link",
                      "children": [
                        {
                          "type": "text",
                          "text": "Inland Revenue",
                          "format": 0,
                          "detail": 0,
                          "mode": "normal",
                          "style": "",
                          "version": 1
                        }
                      ],
                      "direction": "ltr",
                      "format": "",
                      "indent": 0,
                      "version": 3,
                      "fields": {
                        "linkType": "custom",
                        "url": "https://www.ird.govt.nz/income-tax/income-tax-for-individuals/individual-tax-credits/donation-tax-credits/about-donation-tax-credits",
                        "newTab": true
                      }
                    },
                    {
                      "type": "text",
                      "text": ": donation tax credit eligibility and receipts.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "Speak to a pastor or your Connect Group leader if you would like someone to talk and pray with.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "If money is being kept from you, you’re afraid to talk about it at home, or gambling is part of the picture, please speak to a pastor on your own. You don’t have to raise it in front of anyone.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        },
        {
          "id": "s3-block-037",
          "blockType": "coursePrompt",
          "prompt": "Are Christians required to tithe?",
          "guidance": "No percentage is commanded in the New Testament. Israel’s tithes supported the Levites and the poor (Numbers 18:21; Deuteronomy 14:28–29). The New Testament measures giving by grace, proportion and sacrifice (2 Corinthians 8:3, 9, 12). Ten percent is a good marker and a poor ceiling."
        },
        {
          "id": "s3-block-038",
          "blockType": "coursePrompt",
          "prompt": "Do I work it out on income before or after tax?",
          "guidance": "Scripture doesn’t say. Pick one, be consistent, and don’t let the question become a way to give less. Eligible donations can qualify for a tax credit of one third, subject to receipts and taxable-income limits."
        },
        {
          "id": "s3-block-039",
          "blockType": "coursePrompt",
          "prompt": "Should I give while I’m in debt?",
          "guidance": "Yes, something, in proportion (2 Corinthians 8:12), because giving first is about who you trust. And clear the debt fast, because you also owe your creditors (Romans 13:8). Don’t give borrowed money."
        },
        {
          "id": "s3-block-040",
          "blockType": "coursePrompt",
          "prompt": "Should all my giving go to Ev?",
          "guidance": "First, not only. The local church is where you’re taught and where gospel workers are supported (Galatians 6:6; 1 Timothy 5:17–18). Beyond it, give to mission and to people in need (Galatians 2:10)."
        },
        {
          "id": "s3-block-041",
          "blockType": "coursePrompt",
          "prompt": "I send money to family overseas. Does that count as giving?",
          "guidance": "It counts as obedience. Providing for relatives is a first-order duty (1 Timothy 5:4, 8). Put it in the Live bucket as a named line. Giving to gospel work is a separate line."
        },
        {
          "id": "s3-block-042",
          "blockType": "coursePrompt",
          "prompt": "My husband or wife isn’t a Christian and doesn’t want us to give.",
          "guidance": "Don’t give secretly from shared money. Talk openly, and give from what’s agreed or what’s yours to decide. Honesty in the marriage matters more than the amount (1 Peter 3:1–2)."
        },
        {
          "id": "s3-block-043",
          "blockType": "coursePrompt",
          "prompt": "Is saving a lack of faith?",
          "guidance": "No. Proverbs commends it (6:6–8; 21:20). Saving becomes sin when it has no purpose, no limit, and all your trust (Luke 12:21). Name what each saving is for."
        },
        {
          "id": "s3-block-044",
          "blockType": "coursePrompt",
          "prompt": "If I give generously, will God bless me financially?",
          "guidance": "He promises enough for every good work (2 Corinthians 9:8) and treasure in heaven (Matthew 6:20). He doesn’t promise wealth."
        },
        {
          "id": "s3-block-045",
          "blockType": "coursePrompt",
          "prompt": "We honestly can’t make the budget balance.",
          "guidance": "Then the next step is help, not a tighter spreadsheet. Call MoneyTalks, talk to a pastor, and check what you’re entitled to. The church is a family (Galatians 6:2). Let it act like one."
        },
        {
          "id": "s3-block-046",
          "blockType": "courseTeaching",
          "body": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "children": [
                    {
                      "type": "text",
                      "text": "A note on advice",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1,
                  "tag": "h3"
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "text": "This course is teaching and general guidance. It isn’t personal financial advice. For investments, mortgages, insurance and KiwiSaver funds, see a licensed financial adviser.",
                      "format": 0,
                      "detail": 0,
                      "mode": "normal",
                      "style": "",
                      "version": 1
                    }
                  ],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "version": 1
                }
              ],
              "direction": "ltr",
              "format": "",
              "indent": 0,
              "version": 1
            }
          }
        }
      ]
    }
  ]
} satisfies RequiredDataFromCollectionSlug<'courses'>

export const faithfulWithMoneyCourse = {
  ...originalFaithfulWithMoneyCourse,
  lessons: enrichFaithfulIndividualCopy(originalFaithfulWithMoneyCourse.lessons).lessons,
} satisfies RequiredDataFromCollectionSlug<'courses'>
