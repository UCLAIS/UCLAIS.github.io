---
slug: first-neural-network
title: >-
    The First Neural Network: Foundations of Modern AI
authors: [rivan]
tags: [history, neural networks, turing, deep learning]
---
Neural networks have shaped the way we interact with the world. From the deep learning technologies behind self-driving cars to the Natural Language Processing enhancements that power intelligent systems, neural networks are at the forefront of modern AI. But to truly appreciate the deep learning applications we use today, it’s important to examine the foundational theories that lay the groundwork for the field. By first looking at what a neural network is and then exploring the concepts underlying McCulloch and Pitts' theoretical neural network design, we can better appreciate the ingenuity of the technology that has transformed modern AI.

### What is a Neural Network?
A neural network is a computational model inspired by the structure of the brain. Neural networks typically consist of layers of nodes, or artificial neurons—an input layer, one or more hidden layers, and an output layer—connected to each other in a way that mimics the interconnected nature of neurons in the brain. Each node has its own weight and threshold associated with it. If the output of any individual node is above the specified threshold value, it becomes activated, passing information to the next layer. The network "learns" by adjusting the weights of these connections through a process called backpropagation, which minimizes errors over multiple training iterations.

Modern neural networks are complex multi-layered networks capable of solving intricate tasks like image recognition, natural language processing, and autonomous driving. They have had a profound impact on modern technology, revolutionizing and enriching people's lives through their application in solutions ranging from large language models like GPT-4 to advancements in healthcare, such as disease detection and drug discovery.

![How an artificial neural network works: input layer, hidden layers, output layers. (Image source: Facundo Bre)](/img/blog/neural-network-1.png)

### The Turing Machine
To truly appreciate modern neural networks, it’s important to look at the story of their first theoretical inception. The origins of neural networks are intertwined with the origins of artificial intelligence itself, beginning in Cambridge in 1936, where a mathematician named Alan Turing was quietly laying the foundation for modern AI.

In 1936, Turing was tasked with the *Entscheidungsproblem*, a question posing whether there is an algorithm that can determine the truth or falsity of any statement within a specified system. To prove that no such algorithm exists for sufficiently complex systems, Turing invented a theoretical problem-solving machine called a Turing Machine. A Turing Machine consists of an infinite tape divided into cells, a head that can read and write symbols on the tape, and a set of rules. The machine operates by moving the head along the tape, reading symbols, and following the rules to write new symbols and move left or right, allowing it to simulate any algorithm given to it.

Using this, he answered the *Entscheidungsproblem* by proving that no algorithm can universally decide whether an arbitrary Turing machine will halt or run forever on a given input. This became known as the Halting Problem, which he detailed in his 1936 paper *“On Computable Numbers, with an Application to the Entscheidungsproblem.”* Turing’s insight—that any computable function could be broken down into simple operations through reading and writing symbols on an infinite tape—was a revolutionary idea that sparked the development of all artificial intelligence fields that followed.

![The Universal Turing machine: complete with Turing Machine descriptions, tape, and transitions. (Image source: MIT)](/img/blog/neural-network-2.gif)

### The First Neural Network
Inspired by Turing’s 1936 paper, Warren McCulloch, a neuroscientist, and Walter Pitts, a logician, published their influential 1943 paper *"A Logical Calculus of the Ideas Immanent in Nervous Activity"* in which they explored how the brain might perform computations. Turing’s paper provided a theoretical basis for thinking of computation in strictly formal terms and had shown that any computable function could be realized by a Turing machine. Pitts and McCulloch saw a parallel between Turing’s machine and the way groups of neurons might process and transmit information.

They proposed that neurons could be modeled as binary on-off units, firing when inputs exceeded a certain threshold (akin to receiving enough excitatory signals). By connecting these idealized neurons in various configurations, they demonstrated that the systems could implement basic logical operators like AND, OR, and NOT. This offered the possibility that these systems might simulate logical operations or even more complex computations. They were the first to describe what later researchers would call a neural network.

![The McCulloch-Pitts Neuron Model. (Image source: available under fair use, Creative Commons)](/img/blog/neural-network-3.png)

Although their model was only theoretical and faced several limitations, their mathematical approach to neural functioning inspired subsequent generations of researchers—paving the way for cybernetics and later the field of artificial intelligence. Their work ultimately shaped the path for modern AI and deep learning, which are now deeply embedded in our everyday lives.

### References
A. Turing, “On Computable Numbers, with an Application to the Entscheidungsproblem,” 1936. Available: https://www.cs.virginia.edu/~robins/Turing_Paper_1936.pdf.

W. S. Mcculloch and W. Pitts, “A LOGICAL CALCULUS OF THE IDEAS IMMANENT IN NERVOUS ACTIVITY*,” Bulletin of Mathematical Biology, vol. 52, no. 2, pp. 99–115, 1943, Available: https://www.cs.cmu.edu/~./epxing/Class/10715/reading/McCulloch.and.Pitts.pdf.