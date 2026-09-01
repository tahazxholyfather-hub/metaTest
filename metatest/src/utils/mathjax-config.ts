export const initMathJax = () => {
    if ((window as any).MathJax) return;

    (window as any).MathJax = {
        tex: {
            inlineMath: [['$', '$']],
            displayMath: [['$$', '$$']],
            packages: { '[+]': ['mhchem'] }
        },
        loader: {
            load: ['[tex]/mhchem'],
            paths: { mathjax: '/mathjax' }
        },
        startup: {
            ready: () => {
                const MathJax = (window as any).MathJax;
                MathJax.startup.defaultReady();
            }
        }
    };

    const script = document.createElement('script');
    script.src = '/mathjax/tex-mml-svg.js';
    script.async = true;
    document.head.appendChild(script);
};
