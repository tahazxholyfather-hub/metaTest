declare global {
    interface Window {
        MathJax: any;
    }
}

if (!window.MathJax) {
    window.MathJax = {
        tex: {
            inlineMath: [
                ['$', '$'],
                ['\\(', '\\)'],
            ],

            displayMath: [
                ['$$', '$$'],
                ['\\[', '\\]'],
            ],

            processEscapes: true,

            packages: {
                '[+]': [
                    'ams',
                    'bbox',
                    'boldsymbol',
                    'braket',
                    'cancel',
                    'color',
                    'enclose',
                    'extpfeil',
                    'html',
                    'mhchem',
                    'physics',
                    'unicode',
                    'verb',
                ],
            },
        },

        svg: {
            fontCache: 'none',
        },

        loader: {
            load: [
                '[tex]/ams',
                '[tex]/bbox',
                '[tex]/boldsymbol',
                '[tex]/braket',
                '[tex]/cancel',
                '[tex]/color',
                '[tex]/enclose',
                '[tex]/extpfeil',
                '[tex]/html',
                '[tex]/mhchem',
                '[tex]/physics',
                '[tex]/unicode',
                '[tex]/verb',
            ],
        },

        startup: {
            typeset: false,
        },
    };

    const script = document.createElement('script');

    script.src = '/mathjax/tex-mml-svg.js';

    script.async = true;

    document.head.appendChild(script);
}

export {};