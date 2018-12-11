import React from "react";
import { NamespacesConsumer } from "react-i18next";

function returnBlankString() {
    return "";
}

/**
 * Like the react-18next NamespacesConsumer, except while translations are being loaded
 * it displays them as an empty string rather than the fallback. If finding the
 * translation fails, will still display the fallback.
 */
export default function MagdaNamespacesConsumer(props) {
    const passThroughProps = {
        ...props,
        children: (translate, options) => {
            const modifiedTranslate = options.ready
                ? translate
                : returnBlankString;
            return props.children(modifiedTranslate, options);
        }
    };

    return <NamespacesConsumer {...passThroughProps} />;
}
