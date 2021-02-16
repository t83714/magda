function delay(time: number = 1): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}

export default delay;
