import React from 'react';
import './GraphSection.css';

const GraphSection = ({
    eyebrow,
    title,
    subtitle,
    actions = null,
    dark = false,
    className = '',
    children,
}) => {
    return (
        <section className={`graph-section ${dark ? 'graph-section--dark' : ''} ${className}`.trim()}>
            <div className="graph-section__header">
                <div className="graph-section__copy">
                    {eyebrow ? <span className="graph-section__eyebrow">{eyebrow}</span> : null}
                    {title ? <h2 className="graph-section__title">{title}</h2> : null}
                    {subtitle ? <p className="graph-section__subtitle">{subtitle}</p> : null}
                </div>
                {actions ? <div className="graph-section__actions">{actions}</div> : null}
            </div>

            <div className="graph-section__body">
                {children}
            </div>
        </section>
    );
};

export default GraphSection;
