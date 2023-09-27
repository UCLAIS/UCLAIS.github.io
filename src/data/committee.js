const committee = {
  categories: [
    {
      title: 'Leadership',
      members: [
        {
          name: 'Martynas Pocius',
          position: 'President',
          image: 'martynas_pocius.jpg',
          course: 'MEng Biomedical Engineering (4th year)',
          ai_concept: '',
          fact: 'I have been playing piano for 13 years.',
        },
        {
          name: 'Serene Lim',
          position: 'Vice-President',
          image: 'serene_lim.jpg',
          course: 'BASc Arts and Sciences (3rd year)',
          ai_concept: 'Gale-Shapley Algorithm ',
          fact: 'My fingerprints are legally broken!',
        },
        {
          name: 'Franek Nowak',
          position: 'Treasurer',
          image: 'franek_nowak.jpg',
          course: 'MSc Medical Robotics & AI',
          ai_concept: 'Cat-GPT (not a typo!)',
          fact: 'I became a competitive fencer after I was kicked out from music school',
        },
        {
          name: 'Edoardo Lorenzetti',
          position: 'Head of Operations',
          image: 'edoardo_lorenzetti.jpg',
          course: 'MSci Management Science (4th year)',
          ai_concept: '',
          fact: 'I am a tube nerd :-)',
        },
      ],
    },
    {
      title: 'Content',
      members: [
        {
          name: 'Charlie Harrison',
          position: 'Head of Content',
          image: 'charlie_harrison.PNG',
          course: 'BSc Philosophy, Politics and Economics (2nd year)',
          ai_concept: '(Aligned) Large Language Models ',
          fact: 'I spent 4 months living at a Buddhist temple ',
        },
      ],
    },
    {
      title: 'Development',
      members: [
        {
          name: 'Andrzej Szablewski',
          position: 'Head of Development',
          image: 'andrzej_szablewski.jpg',
          course: 'MEng Computer Science (4th year)',
          ai_concept: 'Transformers for the win!',
          fact: 'I love taking pictures of planes! 🛩️ 📸',
        },
        {
          name: 'Robbie Morris',
          position: 'Development Officer',
          image: 'robbie_morris.jpg',
          course: 'BSc Computer Science (2nd year)',
          ai_concept: '',
          fact: 'I used to be a clarinet soloist in my school orchestra!',
        },
        {
          name: 'Szymon Duchniewicz',
          position: 'Development Officer',
          image: 'szymon_duchniewicz.jpg',
          course: 'MEng Computer Science (4th year)',
          ai_concept: 'AI on Embedded Systems & 2/3D Generative AI',
          fact: "I'm a wannabe full-time windsurfer, if I start talking about it, I won't stop.💨🏄",
        },
        {
          name: 'Wonjun Lee',
          position: 'Development Officer',
          image: 'wonjun_lee.jpeg',
          course: 'BSc Computer Science (2nd year)',
          ai_concept: 'Reinforcement Learning',
          fact: 'I can cook minute rice in 58 seconds.',
        },
      ],
    },
    {
      title: 'Events',
      members: [
        {
          name: 'Ivana He',
          position: 'Head of Events',
          image: 'ivana_he.jpg',
          course: 'BASc Arts and Sciences (3rd year)',
          ai_concept: '',
          fact: "I used to be in a communist children's dance group, but now I dance around a pole!",
        },
        {
          name: 'Jess Tsang',
          position: 'Events Officer',
          image: 'jessica_tsang.JPG',
          course: 'BASc Arts and Sciences (3rd year)',
          ai_concept:
            'Basic answer but I could read about transformers all day.',
          fact: 'I’m a published writer and can play 5 musical instruments!',
        },
      ],
    },
    {
      title: 'Journal Club',
      members: [
        {
          name: 'Filip Trhlík',
          position: 'Journal Club Coordinator',
          image: 'filip_trhlik.jpg',
          course: 'BSc Computer Science (3rd year)',
          ai_concept: '',
          fact: 'I have published an article about generating fake news with GPT-3.',
        },
      ],
    },
    {
      title: 'Marketing',
      members: [
        {
          name: 'Nadia Najihah',
          position: 'Head of Marketing',
          image: 'nadia_najihah.jpg',
          course: 'BSc Computer Science (2nd year)',
          ai_concept: '',
          fact: 'My Spotify listening time in 2022 was 77,827 minutes.',
        },
        {
          name: 'Prasham Jadhwani',
          position: 'Marketing Officer',
          image: '',
          course: 'MEng Computer Science (3rd year)',
          ai_concept: '',
          fact: '',
        },
        {
          name: 'Ethan Legson',
          position: 'Marketing Officer',
          image: '',
          course: 'BSc Computer Science (2nd year)',
          ai_concept: '',
          fact: '',
        },
        {
          name: 'Auni Hazwani',
          position: 'Marketing Officer',
          image: '',
          course: 'BSc Psychology (2nd year)',
          ai_concept: '',
          fact: '',
        },
      ],
    },
    {
      title: 'Nexus Labs',
      members: [
        {
          name: 'Ferran Junoy',
          position: 'Head of Nexus Labs',
          image: 'ferran_junoy.jpg',
          course: 'MSci Neuroscience (3rd year)',
          ai_concept: 'Spiking neural networks',
          fact: 'I write poetry in French and am creating a book',
        },
      ],
    },
    {
      title: 'Outreach',
      members: [
        {
          name: 'Miriam Jansen',
          position: 'Head of Outreach',
          image: 'miriam_jansen.jpg',
          course: 'BSc Neuroscience (3rd year)',
          ai_concept: '',
          fact: 'I make my own jewellery.',
        },
      ],
    },
    {
      title: 'Tutorials',
      members: [
        {
          name: 'Angela Yu',
          position: 'Head of Tutorials',
          image: 'angela_yu.png',
          course: 'MEng Computer Science (4th year)',
          ai_concept: 'YOLO (you only look once) object detection algorithm!',
          fact: 'I am a top 0.05% Taylor Swift listener on Spotify :)',
        },
        {
          name: 'Damien Bose',
          position: 'ML Officer',
          image: 'damien_bose.jpg',
          course: 'MEng Mathematical Computation (4th year)',
          ai_concept: 'Variational autoencoder',
          fact: 'I got OpenAI to rename one of their variables.',
        },
        {
          name: 'Suhail Merali',
          position: 'ML Officer',
          image: 'suhail_merali.png',
          course: 'MEng Mathematical Computation (4th year)',
          ai_concept: 'Regression',
          fact: '',
        },
        {
          name: 'Arham Ali',
          position: 'Tutorials Reviewer',
          image: 'arham_ali.jpg',
          course: '',
          ai_concept: '',
          fact: '',
        },
      ],
    },
    {
      title: 'Welfare',
      members: [
        {
          name: 'Migle Jauniskyte',
          position: 'Welfare Officer',
          image: '',
          course: '',
          ai_concept: '',
          fact: '',
        },
      ],
    },
  ],
}

export default committee
